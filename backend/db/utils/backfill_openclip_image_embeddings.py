"""
Backfill OpenCLIP embeddings into pgvector (Phase 1) — production grade.

Features:
- JSON logging + rotating file logs
- Checkpointing (resume safely)
- Retry + exponential backoff (429/5xx/timeouts)
- Rate limiting (req/sec)
- Dry-run mode (no DB writes)
- Batching + throughput metrics

Run examples:
- Images:
  python -m backend.db.import.backfill_openclip_embeddings --mode images --batch-size 32
- Resume from checkpoint automatically:
  python -m backend.db.import.backfill_openclip_embeddings --mode images
- Dry run:
  python -m backend.db.import.backfill_openclip_embeddings --mode images --dry-run
- Be gentle to sources:
  python -m backend.db.import.backfill_openclip_embeddings --mode images --rps 1.5 --batch-size 16
"""

import argparse
import json
import logging
import os
import random
import sys
import time
import uuid
import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Callable
from sqlalchemy.exc import OperationalError, DBAPIError


import numpy as np
import requests
import torch
import torch.nn.functional as F
from logging.handlers import RotatingFileHandler
from PIL import Image as PILImage
from sqlalchemy.orm import Session
from tqdm import tqdm

import open_clip

# ---- Your project imports (adjust if needed) ----
from db.session import SessionLocal
from db.models import Image, ImageEmbedding, ProductVariant, VariantEmbedding, Product, Brand, Category

DIM = 768  # OpenCLIP ViT-L/14 = 768


# -----------------------------
# Logging (production-grade)
# -----------------------------

class JsonFormatter(logging.Formatter):
    def __init__(self, run_id: str):
        super().__init__()
        self.run_id = run_id

    def format(self, record: logging.LogRecord) -> str:
        base = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "run_id": self.run_id,
        }

        # attach metadata
        for key in (
            "mode", "batch_size", "device", "processed", "skipped", "errors",
            "elapsed_s", "items_per_s", "last_id", "image_id", "variant_id", "url",
            "dry_run", "checkpoint_path", "rps", "commit_every",
        ):
            if hasattr(record, key):
                base[key] = getattr(record, key)

        if record.exc_info:
            base["exc"] = self.formatException(record.exc_info)

        return json.dumps(base, ensure_ascii=False)


def init_logger(
    *,
    run_id: str,
    log_dir: str = "backend/logs/v0_0",
    level: str = "INFO",
    console_json: bool = False,
) -> logging.Logger:
    os.makedirs(log_dir, exist_ok=True)
    logger = logging.getLogger("backfill_openclip")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    logger.propagate = False

    if logger.handlers:
        return logger

    # quiet noisy libs
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("PIL").setLevel(logging.WARNING)

    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(getattr(logging, level.upper(), logging.INFO))
    ch.setFormatter(JsonFormatter(run_id) if console_json else logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    ))
    logger.addHandler(ch)

    fname = os.path.join(log_dir, f"backfill_openclip_{run_id}.log")
    fh = RotatingFileHandler(fname, maxBytes=10_000_000, backupCount=5)
    fh.setLevel(getattr(logging, level.upper(), logging.INFO))
    fh.setFormatter(JsonFormatter(run_id))
    logger.addHandler(fh)

    return logger


# -----------------------------
# Checkpointing
# -----------------------------

@dataclass
class Checkpoint:
    mode: str
    last_id: int
    processed: int
    skipped: int
    errors: int
    updated_at_utc: str

    @staticmethod
    def default(mode: str) -> "Checkpoint":
        return Checkpoint(
            mode=mode,
            last_id=0,
            processed=0,
            skipped=0,
            errors=0,
            updated_at_utc=datetime.now(timezone.utc).isoformat(),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mode": self.mode,
            "last_id": self.last_id,
            "processed": self.processed,
            "skipped": self.skipped,
            "errors": self.errors,
            "updated_at_utc": self.updated_at_utc,
        }

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "Checkpoint":
        return Checkpoint(
            mode=str(d.get("mode")),
            last_id=int(d.get("last_id", 0)),
            processed=int(d.get("processed", 0)),
            skipped=int(d.get("skipped", 0)),
            errors=int(d.get("errors", 0)),
            updated_at_utc=str(d.get("updated_at_utc", "")) or datetime.now(timezone.utc).isoformat(),
        )


def load_checkpoint(path: str, mode: str, logger: logging.Logger) -> Checkpoint:
    if not os.path.exists(path):
        cp = Checkpoint.default(mode)
        logger.info("no checkpoint found; starting fresh", extra={"mode": mode, "checkpoint_path": path})
        return cp
    try:
        with open(path, "r") as f:
            d = json.load(f)
        cp = Checkpoint.from_dict(d)
        if cp.mode != mode:
            logger.warning(
                "checkpoint mode mismatch; ignoring checkpoint",
                extra={"mode": mode, "checkpoint_path": path},
            )
            return Checkpoint.default(mode)
        logger.info(
            "loaded checkpoint",
            extra={"mode": mode, "checkpoint_path": path, "last_id": cp.last_id, "processed": cp.processed},
        )
        return cp
    except Exception:
        logger.error("failed to load checkpoint; starting fresh", extra={"mode": mode, "checkpoint_path": path}, exc_info=True)
        return Checkpoint.default(mode)


def save_checkpoint(path: str, cp: Checkpoint, logger: logging.Logger) -> None:
    try:
        cp.updated_at_utc = datetime.now(timezone.utc).isoformat()
        tmp = path + ".tmp"
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(tmp, "w") as f:
            json.dump(cp.to_dict(), f, indent=2)
        os.replace(tmp, path)
        logger.info("checkpoint saved", extra={"mode": cp.mode, "checkpoint_path": path, "last_id": cp.last_id})
    except Exception:
        logger.error("failed to save checkpoint", extra={"mode": cp.mode, "checkpoint_path": path}, exc_info=True)


# -----------------------------
# Rate limiting + retry
# -----------------------------

class RateLimiter:
    """
    Simple token-ish limiter: ensures at most RPS by sleeping between requests.
    """
    def __init__(self, rps: float):
        self.rps = max(0.0, float(rps))
        self._min_interval = (1.0 / self.rps) if self.rps > 0 else 0.0
        self._last = 0.0

    def wait(self) -> None:
        if self._min_interval <= 0:
            return
        now = time.time()
        dt = now - self._last
        if dt < self._min_interval:
            time.sleep(self._min_interval - dt)
        self._last = time.time()


def is_disconnect_error(e: BaseException) -> bool:
    msg = str(e).lower()
    return any(s in msg for s in [
        "ssl syscall error",
        "operation timed out",
        "could not receive data from server",
        "server closed the connection",
        "connection not open",
        "connection reset by peer",
        "terminating connection",
    ])

def db_call_with_retry(
    fn,
    *,
    make_session,
    close_session,
    logger,
    mode: str,
    max_retries: int = 5,
    base_sleep: float = 1.0,
):
    """Runs a DB callable; on disconnect, recreates the session and retries."""
    attempt = 0
    while True:
        try:
            return fn()
        except (OperationalError, DBAPIError) as e:
            attempt += 1
            if attempt > max_retries or not is_disconnect_error(e):
                raise
            sleep_s = min(30.0, base_sleep * (2 ** (attempt - 1))) * (0.7 + 0.6 * random.random())
            logger.warning(
                "db connection dropped; recreating session and retrying",
                extra={"mode": mode, "elapsed_s": round(sleep_s, 2)},
                exc_info=True,
            )
            try:
                close_session()
            except Exception:
                pass
            time.sleep(sleep_s)
            make_session()


def request_with_retry(
    http: requests.Session,
    url: str,
    *,
    timeout: float,
    limiter: RateLimiter,
    max_retries: int,
    backoff_base: float,
    backoff_cap: float,
    logger: logging.Logger,
    mode: str,
    item_id: int,
) -> requests.Response:
    for attempt in range(max_retries + 1):
        try:
            limiter.wait()
            resp = http.get(url, timeout=timeout, allow_redirects=True)

            # --- hard stop: 404 is permanent ---
            if resp.status_code == 404:
                logger.info(
                    "404 missing object; skipping",
                    extra={"mode": mode, "last_id": item_id, "url": url},
                )
                raise FileNotFoundError(f"404 for {url}")

            # retryable statuses
            if resp.status_code == 429 or 500 <= resp.status_code < 600:
                raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)

            # other 4xx: don't retry (usually permanent)
            if 400 <= resp.status_code < 500:
                logger.warning(
                    "non-retryable 4xx; skipping",
                    extra={"mode": mode, "last_id": item_id, "url": url},
                )
                resp.raise_for_status()

            resp.raise_for_status()
            return resp

        except FileNotFoundError:
            # propagate to caller -> caller will count as skipped
            raise

        except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as e:
            if attempt >= max_retries:
                raise

            sleep_s = min(backoff_cap, backoff_base * (2 ** attempt))
            sleep_s *= (0.7 + 0.6 * random.random())

            # honor Retry-After on 429 if present
            if isinstance(e, requests.HTTPError) and getattr(e, "response", None) is not None:
                if e.response.status_code == 429:
                    ra = e.response.headers.get("Retry-After")
                    if ra:
                        try:
                            sleep_s = max(sleep_s, float(ra))
                        except Exception:
                            pass

            logger.warning(
                "request failed; retrying",
                extra={"mode": mode, "last_id": item_id, "url": url, "elapsed_s": round(sleep_s, 2)},
                exc_info=True,
            )
            time.sleep(sleep_s)

    raise RuntimeError("request retries exhausted")



# -----------------------------
# Image loading/cache
# -----------------------------

def safe_mkdir(p: str) -> None:
    os.makedirs(p, exist_ok=True)


def is_http_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def cache_path_for_url(cache_dir: str, url: str) -> str:
    safe_mkdir(cache_dir)
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()
    return os.path.join(cache_dir, f"{h}.bin")


def load_pil_image_from_path(path: str) -> PILImage.Image:
    with open(path, "rb") as f:
        return PILImage.open(f).convert("RGB")


def load_pil_image_from_url(
    url: str,
    *,
    cache_dir: str,
    http: requests.Session,
    limiter: RateLimiter,
    timeout: float,
    max_retries: int,
    backoff_base: float,
    backoff_cap: float,
    logger: logging.Logger,
    mode: str,
    item_id: int,
) -> PILImage.Image:
    fpath = cache_path_for_url(cache_dir, url)
    if os.path.exists(fpath) and os.path.getsize(fpath) > 0:
        return load_pil_image_from_path(fpath)

    resp = request_with_retry(
        http,
        url,
        timeout=timeout,
        limiter=limiter,
        max_retries=max_retries,
        backoff_base=backoff_base,
        backoff_cap=backoff_cap,
        logger=logger,
        mode=mode,
        item_id=item_id,
    )

    with open(fpath, "wb") as f:
        f.write(resp.content)

    return load_pil_image_from_path(fpath)


# -----------------------------
# OpenCLIP embedder
# -----------------------------

def l2_normalize_torch(x: torch.Tensor, eps: float = 1e-12) -> torch.Tensor:
    return x / (x.norm(dim=-1, keepdim=True).clamp_min(eps))


class OpenCLIPImageEmbedder:
    def __init__(self, device: str):
        self.device = device
        self.model_name = "ViT-L-14"
        self.pretrained = "openai"

        model, _, preprocess = open_clip.create_model_and_transforms(
            self.model_name,
            pretrained=self.pretrained,
        )
        self.model = model.to(self.device).eval()
        self.preprocess = preprocess

    @torch.no_grad()
    def embed_pil_batch(self, pil_images: List[PILImage.Image]) -> np.ndarray:
        if not pil_images:
            return np.zeros((0, DIM), dtype=np.float32)
        imgs = torch.stack([self.preprocess(im) for im in pil_images], dim=0).to(self.device)
        feats = self.model.encode_image(imgs)  # (B, 768)
        feats = l2_normalize_torch(feats).float().cpu().numpy().astype(np.float32)
        return feats

    @torch.no_grad()
    def embed_text(self, texts: List[str]) -> np.ndarray:
        """
        Returns L2-normalized CLIP text embeddings (B, 768).
        """
        if not texts:
            return np.zeros((0, DIM), dtype=np.float32)

        # Tokenize to the model's context length
        tokens = open_clip.tokenize(texts).to(self.device)  # (B, ctx_len)

        feats = self.model.encode_text(tokens)  # (B, 768)
        feats = l2_normalize_torch(feats).float().cpu().numpy().astype(np.float32)
        return feats


    @property
    def model_tag(self) -> str:
        return f"openclip:{self.model_name}:{self.pretrained}"


# -----------------------------
# DB helpers
# -----------------------------

def commit_with_retry(get_db, reconnect, logger, mode: str, max_retries: int = 5):
    def _do_commit():
        get_db().commit()
    return db_call_with_retry(
        _do_commit,
        make_session=reconnect,
        close_session=reconnect,
        logger=logger,
        mode=mode,
        max_retries=max_retries,
    )


def write_variant_embedding_batch_with_retry(
    *,
    get_db,
    reconnect,
    logger,
    rows: List[Dict[str, Any]],
    max_retries: int = 5,
    base_sleep: float = 1.0,
) -> None:
    attempt = 0
    while True:
        db = get_db()
        try:
            for row in rows:
                existing_id = row["existing_id"]
                payload = row["payload"]
                variant_id = row["variant_id"]

                if existing_id is None:
                    db.add(VariantEmbedding(variant_id=variant_id, **payload))
                    continue

                existing = db.get(VariantEmbedding, existing_id)
                if existing is None:
                    db.add(VariantEmbedding(variant_id=variant_id, **payload))
                    continue

                if existing.source_fingerprint != payload["source_fingerprint"] or existing.fused_embedding is None:
                    for key, value in payload.items():
                        setattr(existing, key, value)

            db.commit()
            return
        except (OperationalError, DBAPIError) as e:
            attempt += 1
            try:
                db.rollback()
            except Exception:
                pass
            if attempt > max_retries or not is_disconnect_error(e):
                raise
            sleep_s = min(30.0, base_sleep * (2 ** (attempt - 1))) * (0.7 + 0.6 * random.random())
            logger.warning(
                "variant batch write disconnected; recreating session and replaying batch",
                extra={"mode": "variants", "elapsed_s": round(sleep_s, 2)},
                exc_info=True,
            )
            try:
                reconnect()
            except Exception:
                pass
            time.sleep(sleep_s)
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
            raise

def fetch_images_missing_embeddings(
    db: Session,
    batch_size: int,
    start_image_id: int,
) -> List[Tuple[Image, Optional[ImageEmbedding]]]:
    return (
        db.query(Image, ImageEmbedding)
        .outerjoin(ImageEmbedding, ImageEmbedding.image_id == Image.id)
        .filter(Image.id > start_image_id)
        .filter((ImageEmbedding.id == None) | (ImageEmbedding.embedding == None))  # noqa: E711
        .order_by(Image.id.asc())
        .limit(batch_size)
        .all()
    )


def fetch_variants_missing_embeddings(
    db: Session,
    batch_size: int,
    start_variant_id: int,
) -> List[Tuple[ProductVariant, Optional[VariantEmbedding]]]:
    return (
        db.query(ProductVariant, VariantEmbedding)
        .outerjoin(VariantEmbedding, VariantEmbedding.variant_id == ProductVariant.id)
        .filter(ProductVariant.id > start_variant_id)
        .filter((VariantEmbedding.id == None) | (VariantEmbedding.fused_embedding == None))  # noqa: E711
        .order_by(ProductVariant.id.asc())
        .limit(batch_size)
        .all()
    )


def get_representative_variant_image_url(db: Session, variant_id: int) -> Optional[str]:
    row = (
        db.query(Image)
        .filter(Image.variant_id == variant_id)
        .order_by(Image.id.asc())
        .first()
    )
    if row and row.url:
        return row.url

    v = db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
    if v and v.image_url:
        return v.image_url

    return None


IMAGE_WEIGHTS = [1.0, 0.7, 0.5, 0.25, 0.25, 0.25]
TEXT_PAYLOAD_VERSION = 1
FUSION_RECIPE_VERSION = 1


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def l2_normalize_np(v: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    n = float(np.linalg.norm(v))
    if n < eps:
        return v.astype(np.float32)
    return (v / n).astype(np.float32)


def normalize_identity(url: str) -> str:
    return (url or "").strip().lower()


def dedupe_preserve_order(values: List[str], cap: int = 6) -> List[str]:
    out: List[str] = []
    seen: set[str] = set()
    for value in values:
        norm = normalize_identity(value)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        out.append(value)
        if len(out) >= cap:
            break
    return out


def clean_description_text(raw: Optional[str], max_chars: int = 400) -> str:
    if not raw:
        return ""
    cleaned = " ".join(raw.replace("\n", " ").split())
    junk = [
        "for more information, click detailed images",
        "refer to detailed page images",
        "detailed images",
        "shipping",
    ]
    lowered = cleaned.lower()
    for marker in junk:
        idx = lowered.find(marker)
        if idx >= 0:
            cleaned = cleaned[:idx].strip()
            lowered = cleaned.lower()
    return cleaned[:max_chars].strip()


def compose_variant_text_payload(
    *,
    brand: Optional[str],
    title: Optional[str],
    category_main: Optional[str],
    category_sub: Optional[str],
    color: Optional[str],
    size: Optional[str],
    material: Optional[str],
    pattern: Optional[str],
    fit: Optional[str],
    length: Optional[str],
    heel_height: Optional[str],
    attributes: Optional[Dict[str, Any]],
    description: Optional[str],
) -> str:
    structured: List[str] = []
    ordered_fields = [
        ("brand", brand),
        ("title", title),
        ("category", " > ".join([x for x in [category_main, category_sub] if x])),
        ("color", color),
        ("size", size),
        ("material", material),
        ("pattern", pattern),
        ("fit", fit),
        ("length", length),
        ("heel_height", heel_height),
    ]
    for key, value in ordered_fields:
        if value:
            structured.append(f"{key}: {value}")

    attrs = attributes or {}
    for key in sorted(attrs.keys()):
        value = attrs.get(key)
        if value is None or value == "":
            continue
        structured.append(f"{key}: {value}")

    cleaned_description = clean_description_text(description)
    if cleaned_description:
        structured.append(f"description: {cleaned_description}")

    return "\n".join(structured).strip()


def weighted_pool_embeddings(vectors: List[np.ndarray]) -> Optional[np.ndarray]:
    if not vectors:
        return None
    weights = np.array(IMAGE_WEIGHTS[: len(vectors)], dtype=np.float32)
    if len(weights) < len(vectors):
        tail = np.full((len(vectors) - len(weights),), IMAGE_WEIGHTS[-1], dtype=np.float32)
        weights = np.concatenate([weights, tail], axis=0)
    stacked = np.stack(vectors, axis=0)
    pooled = np.average(stacked, axis=0, weights=weights)
    return l2_normalize_np(pooled)


def fuse_variant_embeddings(
    image_vec: Optional[np.ndarray],
    text_vec: Optional[np.ndarray],
    image_weight: float = 0.7,
    text_weight: float = 0.3,
) -> Optional[np.ndarray]:
    if image_vec is not None and text_vec is not None:
        return l2_normalize_np((image_weight * image_vec) + (text_weight * text_vec))
    if image_vec is not None:
        return l2_normalize_np(image_vec)
    if text_vec is not None:
        return l2_normalize_np(text_vec)
    return None


# -----------------------------
# Backfill routines
# -----------------------------

def backfill_images(
    *,
    get_db: Callable[[], Session],
    reconnect: Callable[[], None],
    embedder: OpenCLIPImageEmbedder,
    http: requests.Session,
    limiter: RateLimiter,
    logger: logging.Logger,
    cp: Checkpoint,
    checkpoint_path: str,
    batch_size: int,
    commit_every: int,
    max_items: Optional[int],
    cache_dir: str,
    timeout: float,
    max_retries: int,
    backoff_base: float,
    backoff_cap: float,
    dry_run: bool,
) -> None:
    t0 = time.time()
    pending_writes = 0

    pbar = tqdm(
        total=max_items if max_items is not None else 0,
        unit="img",
        disable=max_items is None,
    )

    logger.info(
        "start images backfill",
        extra={
            "mode": "images",
            "batch_size": batch_size,
            "device": embedder.device,
            "dry_run": dry_run,
            "rps": limiter.rps,
            "commit_every": commit_every,
        },
    )

    while True:
        if max_items is not None and cp.processed >= max_items:
            break

        # ---- READ: fetch rows missing embeddings ----
        rows = db_call_with_retry(
            lambda: fetch_images_missing_embeddings(
                get_db(),
                batch_size=batch_size,
                start_image_id=cp.last_id,
            ),
            make_session=reconnect,
            close_session=reconnect,
            logger=logger,
            mode="images",
        )

        if not rows:
            break

        try:
            get_db().rollback()
        except Exception:
            pass

        pil_batch: List[PILImage.Image] = []
        ids_batch: List[int] = []
        existing_batch: List[Optional[ImageEmbedding]] = []

        for img_row, emb_row in rows:
            cp.last_id = img_row.id

            if max_items is not None and cp.processed >= max_items:
                break

            if not img_row.url:
                cp.skipped += 1
                continue

            try:
                if is_http_url(img_row.url):
                    pil = load_pil_image_from_url(
                        img_row.url,
                        cache_dir=cache_dir,
                        http=http,
                        limiter=limiter,
                        timeout=timeout,
                        max_retries=max_retries,
                        backoff_base=backoff_base,
                        backoff_cap=backoff_cap,
                        logger=logger,
                        mode="images",
                        item_id=img_row.id,
                    )
                else:
                    pil = load_pil_image_from_path(img_row.url)

                pil_batch.append(pil)
                ids_batch.append(img_row.id)
                existing_batch.append(emb_row)

            except FileNotFoundError:
                cp.skipped += 1
                logger.info(
                    "skipping missing url",
                    extra={
                        "mode": "images",
                        "image_id": img_row.id,
                        "url": img_row.url,
                        "dry_run": dry_run,
                    },
                )

            except Exception:
                cp.errors += 1
                logger.warning(
                    "image load failed",
                    extra={
                        "mode": "images",
                        "image_id": img_row.id,
                        "url": img_row.url,
                        "dry_run": dry_run,
                    },
                    exc_info=True,
                )

        if not pil_batch:
            continue

        try:
            feats = embedder.embed_pil_batch(pil_batch)
        except Exception:
            cp.errors += len(pil_batch)
            logger.error(
                "embedding batch failed",
                extra={
                    "mode": "images",
                    "last_id": cp.last_id,
                    "dry_run": dry_run,
                },
                exc_info=True,
            )
            continue

        if dry_run:
            cp.processed += len(ids_batch)
            if max_items is not None:
                pbar.update(len(ids_batch))
            continue

        # ---- WRITE: apply embeddings ----
        db = get_db()
        try:
            for i, image_id in enumerate(ids_batch):
                vec = feats[i].tolist()
                existing = existing_batch[i]

                if existing is None:
                    db.add(
                        ImageEmbedding(
                            image_id=image_id,
                            model_name=embedder.model_tag,
                            dim=DIM,
                            vector_path=None,
                            embedding=vec,
                        )
                    )
                else:
                    existing.model_name = embedder.model_tag
                    existing.dim = DIM
                    existing.embedding = vec

            pending_writes += len(ids_batch)

            if pending_writes >= commit_every:
                commit_with_retry(get_db, reconnect, logger, mode="images")
                pending_writes = 0

                # ---- MUST-DO FIX #2: clear session state after commit ----
                # Prevents the session from ballooning and reduces weird stale-state issues.
                try:
                    get_db().expire_all()
                except Exception:
                    pass

                save_checkpoint(checkpoint_path, cp, logger)

        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

            # also clear any partially-flushed state
            try:
                get_db().expire_all()
            except Exception:
                pass

            cp.errors += len(ids_batch)
            logger.error(
                "db write/commit failed",
                extra={
                    "mode": "images",
                    "last_id": cp.last_id,
                    "dry_run": dry_run,
                },
                exc_info=True,
            )

        cp.processed += len(ids_batch)
        if max_items is not None:
            pbar.update(len(ids_batch))

        if cp.processed % max(1, batch_size * 10) == 0:
            elapsed = time.time() - t0
            logger.info(
                "progress",
                extra={
                    "mode": "images",
                    "processed": cp.processed,
                    "skipped": cp.skipped,
                    "errors": cp.errors,
                    "elapsed_s": round(elapsed, 2),
                    "items_per_s": round(cp.processed / max(elapsed, 1e-9), 2),
                    "last_id": cp.last_id,
                    "dry_run": dry_run,
                },
            )

    # ---- FINAL FLUSH ----
    if not dry_run:
        try:
            if pending_writes > 0:
                commit_with_retry(get_db, reconnect, logger, mode="images")
                pending_writes = 0

            try:
                get_db().expire_all()
            except Exception:
                pass

            save_checkpoint(checkpoint_path, cp, logger)
        except Exception:
            try:
                get_db().rollback()
            except Exception:
                pass
            try:
                get_db().expire_all()
            except Exception:
                pass
            logger.error(
                "final commit/checkpoint failed",
                extra={
                    "mode": "images",
                    "last_id": cp.last_id,
                    "dry_run": dry_run,
                },
                exc_info=True,
            )

    if max_items is not None:
        pbar.close()

    elapsed = time.time() - t0
    logger.info(
        "done images backfill",
        extra={
            "mode": "images",
            "processed": cp.processed,
            "skipped": cp.skipped,
            "errors": cp.errors,
            "elapsed_s": round(elapsed, 2),
            "items_per_s": round(cp.processed / max(elapsed, 1e-9), 2),
            "last_id": cp.last_id,
            "dry_run": dry_run,
        },
    )



def backfill_variants(
    *,
    get_db: Callable[[], Session],
    reconnect: Callable[[], None],
    embedder: OpenCLIPImageEmbedder,
    http: requests.Session,
    limiter: RateLimiter,
    logger: logging.Logger,
    cp: Checkpoint,
    checkpoint_path: str,
    batch_size: int,
    commit_every: int,
    max_items: Optional[int],
    cache_dir: str,
    timeout: float,
    max_retries: int,
    backoff_base: float,
    backoff_cap: float,
    dry_run: bool,
) -> None:
    t0 = time.time()
    pending_writes = 0

    pbar = tqdm(
        total=max_items if max_items is not None else 0,
        unit="var",
        disable=max_items is None,
    )

    logger.info(
        "start variants backfill",
        extra={
            "mode": "variants",
            "batch_size": batch_size,
            "device": embedder.device,
            "dry_run": dry_run,
            "rps": limiter.rps,
            "commit_every": commit_every,
        },
    )

    while True:
        if max_items is not None and cp.processed >= max_items:
            break

        def _fetch():
            db = get_db()
            return fetch_variants_missing_embeddings(db, batch_size=batch_size, start_variant_id=cp.last_id)

        rows = db_call_with_retry(
            _fetch,
            make_session=reconnect,
            close_session=reconnect,
            logger=logger,
            mode="variants",
        )

        if not rows:
            break

        variant_ids: List[int] = []
        existing_emb_ids: Dict[int, Optional[int]] = {}
        for var_row, emb_row in rows:
            cp.last_id = var_row.id
            if max_items is not None and cp.processed >= max_items:
                break
            variant_ids.append(var_row.id)
            existing_emb_ids[var_row.id] = emb_row.id if emb_row is not None else None

        if not variant_ids:
            continue

        db = get_db()
        try:
            meta_rows = (
                db.query(
                    ProductVariant.id,
                    ProductVariant.image_url,
                    ProductVariant.color,
                    ProductVariant.size,
                    ProductVariant.material,
                    ProductVariant.pattern,
                    ProductVariant.fit,
                    ProductVariant.length,
                    ProductVariant.heel_height,
                    ProductVariant.attributes,
                    Product.name,
                    Product.description,
                    Brand.name,
                    Category.main,
                    Category.sub,
                )
                .join(Product, Product.id == ProductVariant.product_id)
                .outerjoin(Brand, Brand.id == Product.brand_id)
                .outerjoin(Category, Category.id == Product.category_id)
                .filter(ProductVariant.id.in_(variant_ids))
                .all()
            )
            image_rows = (
                db.query(Image.variant_id, Image.id, Image.url)
                .filter(Image.variant_id.in_(variant_ids))
                .order_by(Image.variant_id.asc(), Image.id.asc())
                .all()
            )
        finally:
            try:
                db.rollback()
            except Exception:
                pass

        meta_by_variant: Dict[int, Dict[str, Any]] = {}
        for row in meta_rows:
            meta_by_variant[row[0]] = {
                "fallback_image_url": row[1],
                "color": row[2],
                "size": row[3],
                "material": row[4],
                "pattern": row[5],
                "fit": row[6],
                "length": row[7],
                "heel_height": row[8],
                "attributes": row[9] or {},
                "title": row[10],
                "description": row[11],
                "brand": row[12],
                "category_main": row[13],
                "category_sub": row[14],
            }

        image_urls_by_variant: Dict[int, List[Tuple[int, str]]] = {}
        for variant_id, image_id, url in image_rows:
            if variant_id is None or not url:
                continue
            image_urls_by_variant.setdefault(int(variant_id), []).append((int(image_id), url))

        prepared_rows: List[Dict[str, Any]] = []
        for variant_id in variant_ids:
            meta = meta_by_variant.get(variant_id, {})
            image_pairs = image_urls_by_variant.get(variant_id, [])
            ordered_urls = dedupe_preserve_order([url for _, url in image_pairs], cap=6)
            ordered_image_ids = [image_id for image_id, url in image_pairs if url in ordered_urls][: len(ordered_urls)]
            if not ordered_urls and meta.get("fallback_image_url"):
                ordered_urls = [meta["fallback_image_url"]]
                ordered_image_ids = []

            text_payload = compose_variant_text_payload(
                brand=meta.get("brand"),
                title=meta.get("title"),
                category_main=meta.get("category_main"),
                category_sub=meta.get("category_sub"),
                color=meta.get("color"),
                size=meta.get("size"),
                material=meta.get("material"),
                pattern=meta.get("pattern"),
                fit=meta.get("fit"),
                length=meta.get("length"),
                heel_height=meta.get("heel_height"),
                attributes=meta.get("attributes"),
                description=meta.get("description"),
            )
            image_fingerprint = sha256_hex("|".join(normalize_identity(url) for url in ordered_urls)) if ordered_urls else None
            text_fingerprint = sha256_hex(text_payload) if text_payload else None
            source_bits = [
                embedder.model_tag,
                str(TEXT_PAYLOAD_VERSION),
                str(FUSION_RECIPE_VERSION),
                image_fingerprint or "",
                text_fingerprint or "",
            ]
            prepared_rows.append(
                {
                    "variant_id": variant_id,
                    "existing_id": existing_emb_ids.get(variant_id),
                    "image_urls": ordered_urls,
                    "image_ids": ordered_image_ids,
                    "text_payload": text_payload,
                    "image_fingerprint": image_fingerprint,
                    "text_fingerprint": text_fingerprint,
                    "source_fingerprint": sha256_hex("|".join(source_bits)),
                }
            )

        image_inputs: List[PILImage.Image] = []
        image_variant_ids: List[int] = []
        for row in prepared_rows:
            for url in row["image_urls"]:
                try:
                    if is_http_url(url):
                        pil = load_pil_image_from_url(
                            url,
                            cache_dir=cache_dir,
                            http=http,
                            limiter=limiter,
                            timeout=timeout,
                            max_retries=max_retries,
                            backoff_base=backoff_base,
                            backoff_cap=backoff_cap,
                            logger=logger,
                            mode="variants",
                            item_id=row["variant_id"],
                        )
                    else:
                        pil = load_pil_image_from_path(url)
                    image_inputs.append(pil)
                    image_variant_ids.append(row["variant_id"])
                except FileNotFoundError:
                    logger.info(
                        "skipping missing url",
                        extra={"mode": "variants", "variant_id": row["variant_id"], "url": url, "dry_run": dry_run},
                    )
                except Exception:
                    logger.warning(
                        "variant image load failed",
                        extra={"mode": "variants", "variant_id": row["variant_id"], "url": url, "dry_run": dry_run},
                        exc_info=True,
                    )

        image_vectors_by_variant: Dict[int, List[np.ndarray]] = {}
        if image_inputs:
            feats = embedder.embed_pil_batch(image_inputs)
            for idx, variant_id in enumerate(image_variant_ids):
                image_vectors_by_variant.setdefault(variant_id, []).append(feats[idx].astype(np.float32))

        text_payloads = [row["text_payload"] for row in prepared_rows if row["text_payload"]]
        text_variant_ids = [row["variant_id"] for row in prepared_rows if row["text_payload"]]
        text_vectors_by_variant: Dict[int, np.ndarray] = {}
        if text_payloads:
            text_feats = embedder.embed_text(text_payloads)
            for idx, variant_id in enumerate(text_variant_ids):
                text_vectors_by_variant[variant_id] = text_feats[idx].astype(np.float32)

        if dry_run:
            cp.processed += len(prepared_rows)
            if max_items is not None:
                pbar.update(len(prepared_rows))
            continue

        try:
            write_rows: List[Dict[str, Any]] = []
            for row in prepared_rows:
                variant_id = row["variant_id"]
                image_vec = weighted_pool_embeddings(image_vectors_by_variant.get(variant_id, []))
                text_vec = text_vectors_by_variant.get(variant_id)
                fused_vec = fuse_variant_embeddings(image_vec, text_vec)
                status = "ready" if fused_vec is not None else "failed"

                payload = dict(
                    model_name=embedder.model_tag,
                    model_version="v1",
                    dim=DIM,
                    vector_path=None,
                    embedding=fused_vec.tolist() if fused_vec is not None else None,
                    fused_embedding=fused_vec.tolist() if fused_vec is not None else None,
                    embedding_status=status,
                    source_fingerprint=row["source_fingerprint"],
                    text_fingerprint=row["text_fingerprint"],
                    image_fingerprint=row["image_fingerprint"],
                    image_count=len(row["image_urls"]),
                    text_payload_version=TEXT_PAYLOAD_VERSION,
                    fusion_recipe_version=FUSION_RECIPE_VERSION,
                    computed_from_image_ids=row["image_ids"],
                    last_error=None if fused_vec is not None else "missing multimodal inputs",
                    metadata_json={
                        "text_preview": (row["text_payload"][:180] if row["text_payload"] else ""),
                        "image_count": len(row["image_urls"]),
                    },
                )
                write_rows.append(
                    {
                        "variant_id": variant_id,
                        "existing_id": row["existing_id"],
                        "payload": payload,
                    }
                )

            write_variant_embedding_batch_with_retry(
                get_db=get_db,
                reconnect=reconnect,
                logger=logger,
                rows=write_rows,
            )

            pending_writes += len(write_rows)
            if pending_writes >= commit_every:
                pending_writes = 0
                save_checkpoint(checkpoint_path, cp, logger)

        except Exception:
            cp.errors += len(prepared_rows)
            logger.error(
                "db write/commit failed",
                extra={"mode": "variants", "last_id": cp.last_id, "dry_run": dry_run},
                exc_info=True,
            )

        cp.processed += len(prepared_rows)
        if max_items is not None:
            pbar.update(len(prepared_rows))

        if cp.processed % max(1, batch_size * 10) == 0:
            elapsed = time.time() - t0
            logger.info(
                "progress",
                extra={
                    "mode": "variants",
                    "processed": cp.processed,
                    "skipped": cp.skipped,
                    "errors": cp.errors,
                    "elapsed_s": round(elapsed, 2),
                    "items_per_s": round(cp.processed / max(elapsed, 1e-9), 2),
                    "last_id": cp.last_id,
                    "dry_run": dry_run,
                },
            )

    # final commit + checkpoint
    if not dry_run:
        try:
            save_checkpoint(checkpoint_path, cp, logger)
        except Exception:
            try:
                get_db().rollback()
            except Exception:
                pass
            logger.error(
                "final commit/checkpoint failed",
                extra={"mode": "variants", "last_id": cp.last_id, "dry_run": dry_run},
                exc_info=True,
            )

    if max_items is not None:
        pbar.close()

    elapsed = time.time() - t0
    logger.info(
        "done variants backfill",
        extra={
            "mode": "variants",
            "processed": cp.processed,
            "skipped": cp.skipped,
            "errors": cp.errors,
            "elapsed_s": round(elapsed, 2),
            "items_per_s": round(cp.processed / max(elapsed, 1e-9), 2),
            "last_id": cp.last_id,
            "dry_run": dry_run,
        },
    )



# -----------------------------
# CLI
# -----------------------------

def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser()

    ap.add_argument("--mode", choices=["images", "variants"], required=True)

    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--commit-every", type=int, default=256, help="Commit every N embeddings written (reduces DB overhead).")
    ap.add_argument("--max-items", type=int, default=None)

    ap.add_argument("--device", type=str, default=None, help="cuda|cpu (default auto)")
    ap.add_argument("--cache-dir", type=str, default="backend/data/_img_cache")

    # Checkpointing
    ap.add_argument("--checkpoint-path", type=str, default=None, help="Defaults to backend/db/import/_checkpoints/<mode>.json")

    # Networking behavior
    ap.add_argument("--timeout", type=float, default=15.0)
    ap.add_argument("--rps", type=float, default=3.0, help="Max HTTP requests per second (0 disables throttling).")
    ap.add_argument("--max-retries", type=int, default=5)
    ap.add_argument("--backoff-base", type=float, default=0.5)
    ap.add_argument("--backoff-cap", type=float, default=20.0)

    ap.add_argument("--dry-run", action="store_true", help="Compute embeddings but do not write to DB.")

    # Logging
    ap.add_argument("--log-dir", type=str, default="backend/logs")
    ap.add_argument("--log-level", type=str, default="INFO")
    ap.add_argument("--console-json", action="store_true")

    return ap.parse_args()


def main() -> None:
    args = parse_args()
    run_id = uuid.uuid4().hex[:12]
    logger = init_logger(run_id=run_id, log_dir=args.log_dir, level=args.log_level, console_json=args.console_json)

    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")

    checkpoint_path = args.checkpoint_path
    if checkpoint_path is None:
        checkpoint_path = os.path.join("backend", "db", "import", "_checkpoints", f"{args.mode}.json")

    logger.info(
        "run start",
        extra={
            "mode": args.mode,
            "batch_size": args.batch_size,
            "device": device,
            "dry_run": args.dry_run,
            "checkpoint_path": checkpoint_path,
            "rps": args.rps,
            "commit_every": args.commit_every,
        },
    )

    # persistent HTTP session
    http = requests.Session()
    http.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.musinsa.com/",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
    })
    limiter = RateLimiter(args.rps)

    embedder = OpenCLIPImageEmbedder(device=device)

    db: Session = SessionLocal()

    def get_db() -> Session:
        return db

    def reconnect_db():
        nonlocal db
        try:
            db.close()
        except Exception:
            pass
        db = SessionLocal()

    try:
        cp = load_checkpoint(checkpoint_path, mode=args.mode, logger=logger)

        if args.mode == "images":
            backfill_images(
                get_db=get_db,
                reconnect=reconnect_db,
                embedder=embedder,
                http=http,
                limiter=limiter,
                logger=logger,
                cp=cp,
                checkpoint_path=checkpoint_path,
                batch_size=args.batch_size,
                commit_every=args.commit_every,
                max_items=args.max_items,
                cache_dir=args.cache_dir,
                timeout=args.timeout,
                max_retries=args.max_retries,
                backoff_base=args.backoff_base,
                backoff_cap=args.backoff_cap,
                dry_run=args.dry_run,
            )
        else:
            backfill_variants(
                get_db=get_db,
                reconnect=reconnect_db,
                embedder=embedder,
                http=http,
                limiter=limiter,
                logger=logger,
                cp=cp,
                checkpoint_path=checkpoint_path,
                batch_size=args.batch_size,
                commit_every=args.commit_every,
                max_items=args.max_items,
                cache_dir=args.cache_dir,
                timeout=args.timeout,
                max_retries=args.max_retries,
                backoff_base=args.backoff_base,
                backoff_cap=args.backoff_cap,
                dry_run=args.dry_run,
            )

    except KeyboardInterrupt:
        logger.warning("interrupted by user", extra={"mode": args.mode, "dry_run": args.dry_run})
        raise
    except Exception:
        logger.error("fatal error", extra={"mode": args.mode, "dry_run": args.dry_run}, exc_info=True)
        try:
            save_checkpoint(checkpoint_path, cp, logger)
        except Exception:
            pass
        raise
    finally:
        db.close()
        http.close()

    logger.info("run complete", extra={"mode": args.mode, "dry_run": args.dry_run})


if __name__ == "__main__":
    torch.multiprocessing.set_start_method("spawn", force=True)
    main()
