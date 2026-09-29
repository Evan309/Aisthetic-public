# backend/api/routers/search.py


from typing import Any, Dict, List, Optional, Tuple, Union
import base64
import io
import os
import time
import uuid
import psutil
import logging

logger = logging.getLogger(__name__)

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, Request
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from PIL import Image as PILImage, ImageOps
from sqlalchemy import select, text, cast, Float, bindparam, Integer, and_, or_, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime, timedelta, timezone

from db.dependencies import get_db
from db.models import (
    User,
    Image,
    ImageEmbedding,
    VariantEmbedding,
    SearchResultCache,
    Closet,
    ClosetItem,
    ClosetCollaborator,
    SearchEvent,
    SearchSession,
    Product,
    ProductVariant,
    PriceHistory,
    Brand,
    Category,
)

# Embedders
from db.utils.backfill_openclip_image_embeddings import OpenCLIPImageEmbedder

# Auth
from auth.dependencies import http_bearer, validate_jwt, get_or_create_user
from auth.current_user import get_current_user
from middleware.rate_limit import rate_limit_search, rate_limit_upload

# ============================================================
# Memory Logging Utility
# ============================================================

def log_memory(stage: str):
    """Log current memory usage during search operations"""
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    mem_mb = mem_info.rss / 1024 / 1024
    logger.info(f"🔍 SEARCH MEMORY [{stage}]: {mem_mb:.2f} MB ({mem_mb/1024:.2f} GB)")
    return mem_mb

# ... (rest of imports)

router = APIRouter(prefix="/search", tags=["search"])


# ============================================================
# Embedders (singletons)
# ============================================================


# Embedders (singletons)
# ============================================================

from utils.ml import get_embedder

def get_img_embedder() -> OpenCLIPImageEmbedder:
    return get_embedder()

def get_txt_embedder() -> OpenCLIPImageEmbedder:
    return get_embedder()


# ============================================================
# Optional auth (for /multimodal)
# ============================================================

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials is None:
        return None
    payload = validate_jwt(credentials.credentials)
    return get_or_create_user(db, payload, credentials.credentials)


def ensure_closet_access(db: Session, closet_id: int, user_id: int) -> None:
    closet = db.query(Closet.id, Closet.user_id).filter(Closet.id == closet_id).first()
    if closet is None:
        raise HTTPException(status_code=404, detail="Closet not found.")
    if closet.user_id == user_id:
        return
    collab = (
        db.query(ClosetCollaborator.closet_id)
        .filter(
            ClosetCollaborator.closet_id == closet_id,
            ClosetCollaborator.user_id == user_id,
        )
        .first()
    )
    if collab is None:
        raise HTTPException(status_code=404, detail="Closet not found.")


# ============================================================
# Time helpers (DB timestamps are naive; store UTC naive)
# ============================================================

def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ============================================================
# Utilities
# ============================================================

def preprocess_image(pil: PILImage.Image, max_side: int = 768) -> PILImage.Image:
    if max(pil.size) <= max_side:
        return pil
    return ImageOps.contain(pil, (max_side, max_side))


def l2_normalize_np(v: np.ndarray, eps: float = 1e-12) -> np.ndarray:
    n = float(np.linalg.norm(v))
    if n < eps:
        return v.astype(np.float32)
    return (v / n).astype(np.float32)


def cosine_score_from_distance(distance: float) -> float:
    # cosine_distance = 1 - cosine_similarity (for normalized vectors)
    return 1.0 - float(distance)


def pg_cosine_distance(col, qvec: List[float]):
    return cast(col.op("<=>")(qvec), Float)


def is_text_long_or_specific(query_text: str) -> bool:
    s = query_text.strip()
    if not s:
        return False
    return (len(s) >= 40) or (len(s.split()) >= 6)


def early_results_look_weak(scores: List[float]) -> bool:
    if not scores:
        return True
    top1 = scores[0]
    top5 = scores[:5]
    avg5 = float(sum(top5) / len(top5))
    return (top1 < 0.18) or (avg5 < 0.15)


def make_preview_data_url(pil: PILImage.Image, max_side: int = 256, quality: int = 75) -> tuple[str, int, int]:
    preview = ImageOps.contain(pil, (max_side, max_side))
    buf = io.BytesIO()
    preview.save(buf, format="JPEG", quality=quality, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}", int(preview.size[0]), int(preview.size[1])


def store_query_image_and_embedding(
    db: Session,
    pil_full: PILImage.Image,
    vec: np.ndarray,
    model_name: str,
) -> int:
    data_url, w, h = make_preview_data_url(pil_full)

    img = Image(
        product_id=None,
        variant_id=None,
        url=data_url,
        width=w,
        height=h,
        hash=None,
    )
    db.add(img)
    db.commit()
    db.refresh(img)

    emb = ImageEmbedding(
        image_id=img.id,
        model_name=model_name,
        dim=int(len(vec)),
        vector_path=None,
        embedding=vec.astype(np.float32).tolist(),
    )
    db.add(emb)
    db.commit()
    return int(img.id)


# ============================================================
# ANN helpers
# ============================================================

def ann_products_with_scores(
    db: Session,
    query_vec: List[float],
    model_name: str,
    k_images: int,
) -> List[Tuple[int, float]]:
    dist = pg_cosine_distance(ImageEmbedding.embedding, query_vec)

    rows = db.execute(
        select(Image.product_id, dist.label("d"))
        .join(ImageEmbedding, ImageEmbedding.image_id == Image.id)
        .where(
            ImageEmbedding.model_name == model_name,
            ImageEmbedding.embedding.isnot(None),
            Image.product_id.isnot(None),
        )
        .order_by(dist.asc())
        .limit(k_images)
    ).all()

    seen: set[int] = set()
    out: List[Tuple[int, float]] = []
    for pid, d in rows:
        if pid is None:
            continue
        pid_int = int(pid)
        if pid_int in seen:
            continue
        seen.add(pid_int)
        out.append((pid_int, cosine_score_from_distance(float(d))))
    return out


def ann_variants_with_scores(
    db: Session,
    query_vec: List[float],
    model_name: str,
    k_variants: int,
    embedding_field: str = "fused_embedding",
) -> List[Tuple[int, int, float]]:
    emb_col = getattr(VariantEmbedding, embedding_field)
    dist = pg_cosine_distance(emb_col, query_vec)

    rows = db.execute(
        select(ProductVariant.id, ProductVariant.product_id, dist.label("d"))
        .join(VariantEmbedding, VariantEmbedding.variant_id == ProductVariant.id)
        .where(
            VariantEmbedding.model_name == model_name,
            emb_col.isnot(None),
            ProductVariant.product_id.isnot(None),
        )
        .order_by(dist.asc())
        .limit(k_variants)
    ).all()

    out: List[Tuple[int, int, float]] = []
    for vid, pid, d in rows:
        if vid is None or pid is None:
            continue
        out.append((int(vid), int(pid), cosine_score_from_distance(float(d))))
    return out


def late_fusion_merge_ranked(
    img_hits: List[Tuple[int, int, float]],
    txt_hits: List[Tuple[int, int, float]],
    w_img: float,
    w_txt: float,
    max_variants: int,
) -> List[Tuple[int, int, float]]:
    img_map = {vid: (pid, score) for vid, pid, score in img_hits}
    txt_map = {vid: (pid, score) for vid, pid, score in txt_hits}

    merged: List[int] = []
    seen: set[int] = set()
    for vid, _, _ in (img_hits + txt_hits):
        if vid not in seen:
            seen.add(vid)
            merged.append(vid)

    scored: List[Tuple[int, int, float]] = []
    for vid in merged:
        pid = img_map.get(vid, txt_map.get(vid))[0]
        score = (w_img * img_map.get(vid, (pid, 0.0))[1]) + (w_txt * txt_map.get(vid, (pid, 0.0))[1])
        scored.append((vid, pid, score))
    scored.sort(key=lambda x: x[2], reverse=True)
    return scored[:max_variants]



# ============================================================
# Cache helpers
# ============================================================

RECENT_RETENTION_DAYS = 30
AUTH_CACHE_TTL_MINUTES = RECENT_RETENTION_DAYS * 24 * 60  # 43200 minutes

def opportunistic_delete_expired(db: Session) -> None:
    try:
        now = utc_now_naive()
        db.query(SearchResultCache).filter(SearchResultCache.expires_at < now).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()


def create_cache(
    db: Session,
    product_ids: Optional[List[int]],
    mode: str,
    meta: Dict[str, Any],
    ttl_minutes: int,
    scores: Optional[List[float]] = None,
    variant_ids: Optional[List[int]] = None,
) -> SearchResultCache:
    opportunistic_delete_expired(db)

    primary_ids = variant_ids if variant_ids is not None else product_ids
    if primary_ids is None:
        raise HTTPException(status_code=500, detail="Internal error: cache ids missing.")
    if scores is not None and len(scores) != len(primary_ids):
        raise HTTPException(status_code=500, detail="Internal error: scores length mismatch.")

    now = utc_now_naive()
    row = SearchResultCache(
        expires_at=now + timedelta(minutes=ttl_minutes),
        mode=mode,
        product_ids=product_ids,
        variant_ids=variant_ids,
        scores=scores,
        meta={
            **(meta or {}),
            "created_at_utc": now.isoformat(),
            "ttl_minutes": ttl_minutes,
        },
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row



def get_cache_or_410(db: Session, search_id: str) -> SearchResultCache:
    try:
        sid = uuid.UUID(search_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid search_id (must be UUID).")

    cache = db.get(SearchResultCache, sid)
    if cache is None:
        raise HTTPException(status_code=404, detail="Search not found.")

    now = utc_now_naive()
    if cache.expires_at < now:
        try:
            db.delete(cache)
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=410, detail="Search expired.")

    return cache


def create_search_session(
    db: Session,
    *,
    user_id: Optional[int],
    query_text: Optional[str],
    query_image_id: Optional[int],
    mode: str,
    result_cache_id,
    filters: Dict[str, Any],
    latency_ms: Optional[int],
    k: Optional[int],
    query_hash: Optional[str] = None,
) -> SearchSession:
    s = SearchSession(
        user_id=user_id,
        query_text=query_text,
        query_image_id=query_image_id,
        mode=mode,
        result_cache_id=result_cache_id,
        filters=filters or {},
        latency_ms=latency_ms,
        k=k,
        query_hash=query_hash,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def delete_cache_if_unreferenced(db: Session, cache_id) -> None:
    if cache_id is None:
        return
    still_used = db.query(SearchSession.id).filter(SearchSession.result_cache_id == cache_id).first()
    if still_used:
        return
    db.query(SearchResultCache).filter(SearchResultCache.id == cache_id).delete(synchronize_session=False)
    db.commit()


# ============================================================
# Product card hydration
# ============================================================

class ProductCard(BaseModel):
    id: int
    name: str
    image: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    originalPrice: Optional[float] = None
    inStock: bool


def hydrate_product_cards(db: Session, product_ids: list[int]) -> list[ProductCard]:
    if not product_ids:
        return []

    stmt = text("""
        WITH ids AS (
          SELECT * FROM unnest(:ids) WITH ORDINALITY AS t(id, ord)
        ),
        latest_price AS (
          SELECT DISTINCT ON (product_id)
            product_id, regular_price, sale_price
          FROM price_history
          ORDER BY product_id, scraped_at DESC
        ),
        hero AS (
          SELECT DISTINCT ON (product_id)
            product_id, url
          FROM image
          ORDER BY product_id, id
        )
        SELECT
          p.id AS id,
          p.name AS name,
          p.is_available AS is_available,
          b.name AS brand,
          lp.regular_price AS regular_price,
          lp.sale_price AS sale_price,
          h.url AS image
        FROM ids
        JOIN product p ON p.id = ids.id
        LEFT JOIN brand b ON b.id = p.brand_id
        LEFT JOIN latest_price lp ON lp.product_id = p.id
        LEFT JOIN hero h ON h.product_id = p.id
        ORDER BY ids.ord
    """).bindparams(bindparam("ids", type_=ARRAY(Integer)))

    rows = db.execute(stmt, {"ids": product_ids}).mappings().all()

    out: list[ProductCard] = []
    for r in rows:
        sale = r.get("sale_price")
        reg = r.get("regular_price")
        price = float(sale) if sale is not None else (float(reg) if reg is not None else None)
        original = float(reg) if (sale is not None and reg is not None) else None

        out.append(ProductCard(
            id=int(r["id"]),
            name=r["name"],
            image=r.get("image"),
            brand=r.get("brand"),
            price=price,
            originalPrice=original,
            inStock=bool(r.get("is_available")),
        ))
    return out


class SearchProductCard(BaseModel):
    id: int
    product_id: int
    variant_id: Optional[int] = None
    name: str
    image: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    originalPrice: Optional[float] = None
    inStock: bool
    matched_variant_image: Optional[str] = None
    matched_variant_label: Optional[str] = None
    score: Optional[float] = None


def _variant_label(row: dict[str, Any]) -> Optional[str]:
    parts = [row.get("color"), row.get("size"), row.get("material")]
    parts = [str(p).strip() for p in parts if p]
    return " / ".join(parts) if parts else None


def hydrate_variant_cards(
    db: Session,
    variant_pairs: list[tuple[int, ...]],
    score_by_variant_id: Optional[dict[int, float]] = None,
) -> list[SearchProductCard]:
    if not variant_pairs:
        return []

    variant_ids = [int(row[0]) for row in variant_pairs]

    stmt = text("""
        WITH ids AS (
          SELECT * FROM unnest(:variant_ids) WITH ORDINALITY AS t(variant_id, ord)
        ),
        latest_price AS (
          SELECT DISTINCT ON (product_id)
            product_id, regular_price, sale_price
          FROM price_history
          ORDER BY product_id, scraped_at DESC
        ),
        hero AS (
          SELECT DISTINCT ON (variant_id)
            variant_id, url
          FROM image
          WHERE variant_id IS NOT NULL
          ORDER BY variant_id, id
        )
        SELECT
          ids.ord AS ord,
          p.id AS product_id,
          pv.id AS variant_id,
          p.name AS name,
          p.is_available AS is_available,
          b.name AS brand,
          pv.image_url AS variant_image_url,
          h.url AS hero_image,
          pv.color AS color,
          pv.size AS size,
          pv.material AS material,
          lp.regular_price AS regular_price,
          lp.sale_price AS sale_price
        FROM ids
        JOIN product_variant pv ON pv.id = ids.variant_id
        JOIN product p ON p.id = pv.product_id
        LEFT JOIN brand b ON b.id = p.brand_id
        LEFT JOIN latest_price lp ON lp.product_id = p.id
        LEFT JOIN hero h ON h.variant_id = pv.id
        ORDER BY ids.ord
    """).bindparams(bindparam("variant_ids", type_=ARRAY(Integer)))

    rows = db.execute(stmt, {"variant_ids": variant_ids}).mappings().all()
    out: list[SearchProductCard] = []
    for r in rows:
        sale = r.get("sale_price")
        reg = r.get("regular_price")
        price = float(sale) if sale is not None else (float(reg) if reg is not None else None)
        original = float(reg) if (sale is not None and reg is not None) else None
        variant_id = int(r["variant_id"])
        image = r.get("hero_image") or r.get("variant_image_url")
        out.append(
            SearchProductCard(
                id=int(r["product_id"]),
                product_id=int(r["product_id"]),
                variant_id=variant_id,
                name=r["name"],
                image=image,
                brand=r.get("brand"),
                price=price,
                originalPrice=original,
                inStock=bool(r.get("is_available")),
                matched_variant_image=image,
                matched_variant_label=_variant_label(r),
                score=score_by_variant_id.get(variant_id) if score_by_variant_id else None,
            )
        )
    return out


# ============================================================
# API Schemas
# ============================================================

class CachedSearchResponse(BaseModel):
    search_id: str
    session_id: Optional[int] = None
    mode: str
    page: int
    page_size: int
    total_products: int
    has_more: bool
    products: List[SearchProductCard]


class LogSearchEventRequest(BaseModel):
    session_id: int
    event_type: str
    product_id: int
    variant_id: Optional[int] = None
    position: Optional[int] = None
    impression_key: Optional[str] = None


class OkResponse(BaseModel):
    ok: bool = True


class RecentSearchItemOut(BaseModel):
    id: int  # SearchSession.id
    search_id: Optional[str] = None  # SearchResultCache UUID for replay
    mode: str
    query_text: Optional[str] = None
    query_image_url: Optional[str] = None
    created_at: datetime


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/search", tags=["search"])


# ------------------------------------------------------------
# 0) Pagination for cached search
# ------------------------------------------------------------

@router.get("/cache/{search_id}", response_model=CachedSearchResponse)
@rate_limit_search()
def paginate_cached(
    request: Request,
    search_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=100),
    db: Session = Depends(get_db),
):
    mem_start = log_memory("Paginate Cached Request Start")

    cache = get_cache_or_410(db, search_id)

    ids = list(cache.variant_ids or cache.product_ids or [])
    scores = list(cache.scores or []) if getattr(cache, "scores", None) else None

    total = len(ids)
    start = (page - 1) * page_size
    end = start + page_size
    ids_page = ids[start:end]
    score_by_variant_id = {variant_id: float(score) for variant_id, score in zip(ids, scores)} if scores else {}
    variant_pairs = [(variant_id, 0) for variant_id in ids_page]
    products = hydrate_variant_cards(db, variant_pairs, score_by_variant_id)

    # Log memory at end of request
    mem_end = log_memory("Search Request End")
    mem_delta = mem_end - mem_start
    logger.info(f"📊 MEMORY DELTA: {mem_delta:+.2f} MB for this request")

    return CachedSearchResponse(
        search_id=str(cache.id),
        mode=cache.mode,
        page=page,
        page_size=page_size,
        total_products=total,
        has_more=end < total,
        products=products,
    )



# ------------------------------------------------------------
# 1) Image + text search (optionally authed)
# ------------------------------------------------------------

# File upload constants
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

@router.post("/multimodal", response_model=CachedSearchResponse)
@rate_limit_upload()
async def multimodal_search(
    request: Request,
    file: Union[UploadFile, None] = File(None),
    query_text: Union[str, None] = Query(None),

    w_img: float = Query(0.65, ge=0.0, le=1.0),
    w_txt: float = Query(0.35, ge=0.0, le=1.0),

    k_images: int = Query(2000, ge=100, le=5000),
    max_products: int = Query(3000, ge=100, le=10000),

    page_size: int = Query(50, ge=10, le=100),

    # For signed-out users only (signed-in forced to 30 days)
    ttl_minutes: int = Query(20, ge=5, le=43200),

    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
    img_embedder: OpenCLIPImageEmbedder = Depends(get_img_embedder),
    txt_embedder: OpenCLIPImageEmbedder = Depends(get_txt_embedder),
):
    # Log memory at start of request
    mem_start = log_memory("Search Request Start")
    t0 = time.time()

    qt = (query_text or "").strip()
    if file is None and not qt:
        raise HTTPException(status_code=400, detail="Provide an image and/or query_text.")

    # Signed-in sessions: keep cache for 30 days
    effective_ttl_minutes = AUTH_CACHE_TTL_MINUTES if user is not None else ttl_minutes

    img_vec: Optional[np.ndarray] = None
    txt_vec: Optional[np.ndarray] = None
    model_name: Optional[str] = None
    pil_full: Optional[PILImage.Image] = None

    # image with validation
    if file is not None:
        # ✅ Validate content type
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_CONTENT_TYPES)}"
            )
        
        # ✅ Read with size limit
        data = await file.read(MAX_FILE_SIZE + 1)
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        if not data:
            raise HTTPException(status_code=400, detail="Empty upload.")
        
        # ✅ Validate image integrity
        try:
            pil_full = PILImage.open(io.BytesIO(data))
            pil_full.verify()  # Verify image integrity
            # Reopen after verify (verify closes the file)
            pil_full = PILImage.open(io.BytesIO(data)).convert("RGB")
            pil = preprocess_image(pil_full)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid or corrupted image file.")

        img_vec = img_embedder.embed_pil_batch([pil])[0].astype(np.float32)
        model_name = img_embedder.model_tag


    # text
    if qt:
        txt_vec = txt_embedder.embed_text([f"a photo of {qt}"])[0].astype(np.float32)
        if model_name is None:
            model_name = getattr(txt_embedder, "model_tag", None) or img_embedder.model_tag

    # store query image + embedding only when signed-in
    query_image_id: Optional[int] = None
    if user is not None and pil_full is not None and img_vec is not None and model_name is not None:
        query_image_id = store_query_image_and_embedding(db, pil_full, img_vec, model_name)

    # ----------------------------
    # Image-only
    # ----------------------------
    if qt == "":
        ann0 = time.time()
        img_hits = ann_variants_with_scores(db, img_vec.tolist(), model_name, k_images, embedding_field="fused_embedding")
        ann_ms = int((time.time() - ann0) * 1000)

        top = img_hits[:max_products]
        variant_ids = [vid for vid, _, _ in top]
        product_ids = [pid for _, pid, _ in top]
        scores = [float(s) for _, _, s in top]

        cache = create_cache(
            db,
            product_ids=product_ids,
            variant_ids=variant_ids,
            scores=scores,
            mode="image",
            ttl_minutes=effective_ttl_minutes,
            meta={
                "model_name": model_name,
                "query_image_id": query_image_id,
                "k_images": k_images,
                "max_products": max_products,
                "ann_ms": ann_ms,
            },
        )


        total_ms = int((time.time() - t0) * 1000)

        session_id: Optional[int] = None
        if user is not None:
            session = create_search_session(
                db,
                user_id=user.id,
                query_text=None,
                query_image_id=query_image_id,
                mode="image",
                result_cache_id=cache.id,
                filters={},
                latency_ms=total_ms,
                k=k_images,
            )
            session_id = session.id

        score_by_variant_id = {variant_id: float(score) for variant_id, score in zip(variant_ids, scores)}
        products = hydrate_variant_cards(db, top[:page_size], score_by_variant_id)
        return CachedSearchResponse(
            search_id=str(cache.id),
            session_id=session_id,
            mode=cache.mode,
            page=1,
            page_size=page_size,
            total_products=len(variant_ids),
            has_more=len(variant_ids) > page_size,
            products=products,
        )

    # ----------------------------
    # Text-only
    # ----------------------------
    if img_vec is None and txt_vec is not None:
        ann0 = time.time()
        txt_hits = ann_variants_with_scores(db, l2_normalize_np(txt_vec).tolist(), model_name, k_images, embedding_field="fused_embedding")
        ann_ms = int((time.time() - ann0) * 1000)

        top = txt_hits[:max_products]
        variant_ids = [vid for vid, _, _ in top]
        product_ids = [pid for _, pid, _ in top]
        scores = [float(s) for _, _, s in top]

        cache = create_cache(
            db,
            product_ids=product_ids,
            variant_ids=variant_ids,
            scores=scores,
            mode="text",
            ttl_minutes=effective_ttl_minutes,
            meta={
                "model_name": model_name,
                "query_text": qt,
                "k_images": k_images,
                "max_products": max_products,
                "ann_ms": ann_ms,
            },
        )

        total_ms = int((time.time() - t0) * 1000)

        session_id: Optional[int] = None
        if user is not None:
            session = create_search_session(
                db,
                user_id=user.id,
                query_text=qt,
                query_image_id=None,
                mode="text",
                result_cache_id=cache.id,
                filters={},
                latency_ms=total_ms,
                k=k_images,
            )
            session_id = session.id

        score_by_variant_id = {variant_id: float(score) for variant_id, score in zip(variant_ids, scores)}
        products = hydrate_variant_cards(db, top[:page_size], score_by_variant_id)
        return CachedSearchResponse(
            search_id=str(cache.id),
            session_id=session_id,
            mode=cache.mode,
            page=1,
            page_size=page_size,
            total_products=len(variant_ids),
            has_more=len(variant_ids) > page_size,
            products=products,
        )

    # ----------------------------
    # Multimodal
    # ----------------------------
    wsum = float(w_img + w_txt)
    if wsum <= 1e-9:
        w_img_n, w_txt_n = 1.0, 0.0
    else:
        w_img_n, w_txt_n = float(w_img / wsum), float(w_txt / wsum)

    fused = l2_normalize_np((w_img_n * img_vec) + (w_txt_n * txt_vec))

    ann_f0 = time.time()
    fused_hits = ann_variants_with_scores(db, fused.tolist(), model_name, k_images, embedding_field="fused_embedding")
    fused_ann_ms = int((time.time() - ann_f0) * 1000)

    fused_scores = [s for _, _, s in fused_hits[:10]]
    need_late = is_text_long_or_specific(qt) or early_results_look_weak(fused_scores)

    if not need_late:
        top = fused_hits[:max_products]
        variant_ids = [vid for vid, _, _ in top]
        product_ids = [pid for _, pid, _ in top]
        scores = [float(s) for _, _, s in top]

        cache = create_cache(
            db,
            product_ids=product_ids,
            variant_ids=variant_ids,
            scores=scores,
            mode="image_text",
            ttl_minutes=effective_ttl_minutes,
            meta={
                "model_name": model_name,
                "query_text": qt,
                "fusion": "early_only",
                "w_img": w_img_n,
                "w_txt": w_txt_n,
                "k_images": k_images,
                "max_products": max_products,
                "fused_ann_ms": fused_ann_ms,
            },
        )

        total_ms = int((time.time() - t0) * 1000)

        session_id: Optional[int] = None
        if user is not None:
            session = create_search_session(
                db,
                user_id=user.id,
                query_text=qt,
                query_image_id=query_image_id,
                mode="multimodal",
                result_cache_id=cache.id,
                filters={},
                latency_ms=total_ms,
                k=k_images,
            )
            session_id = session.id

        score_by_variant_id = {variant_id: float(score) for variant_id, score in zip(variant_ids, scores)}
        products = hydrate_variant_cards(db, top[:page_size], score_by_variant_id)
        return CachedSearchResponse(
            search_id=str(cache.id),
            session_id=session_id,
            mode=cache.mode,
            page=1,
            page_size=page_size,
            total_products=len(variant_ids),
            has_more=len(variant_ids) > page_size,
            products=products,
        )

    # Conditional late fusion
    ann_i0 = time.time()
    img_hits = ann_variants_with_scores(db, img_vec.tolist(), model_name, k_images, embedding_field="fused_embedding")
    img_ann_ms = int((time.time() - ann_i0) * 1000)

    ann_t0 = time.time()
    txt_hits = ann_variants_with_scores(db, l2_normalize_np(txt_vec).tolist(), model_name, k_images, embedding_field="fused_embedding")
    txt_ann_ms = int((time.time() - ann_t0) * 1000)

    lf_w_img, lf_w_txt = 0.7, 0.3

    late_ranked = late_fusion_merge_ranked(
        img_hits=img_hits,
        txt_hits=txt_hits,
        w_img=lf_w_img,
        w_txt=lf_w_txt,
        max_variants=max_products,
    )

    variant_ids = [vid for vid, _, _ in late_ranked]
    product_ids = [pid for _, pid, _ in late_ranked]
    scores = [float(s) for _, _, s in late_ranked]

    cache = create_cache(
        db,
        product_ids=product_ids,
        variant_ids=variant_ids,
        scores=scores,
        mode="image_text",
        ttl_minutes=effective_ttl_minutes,
        meta={
            "model_name": model_name,
            "query_text": qt,
            "fusion": "early_then_conditional_late",
            "w_img": w_img_n,
            "w_txt": w_txt_n,
            "late_w_img": lf_w_img,
            "late_w_txt": lf_w_txt,
            "k_images": k_images,
            "max_products": max_products,
            "fused_ann_ms": fused_ann_ms,
            "img_ann_ms": img_ann_ms,
            "txt_ann_ms": txt_ann_ms,
        },
    )

    total_ms = int((time.time() - t0) * 1000)

    session_id: Optional[int] = None
    if user is not None:
        session = create_search_session(
            db,
            user_id=user.id,
            query_text=qt,
            query_image_id=query_image_id,
            mode="multimodal",
            result_cache_id=cache.id,
            filters={},
            latency_ms=total_ms,
            k=k_images,
        )
        session_id = session.id

    score_by_variant_id = {variant_id: float(score) for variant_id, score in zip(variant_ids, scores)}
    products = hydrate_variant_cards(db, late_ranked[:page_size], score_by_variant_id)
    return CachedSearchResponse(
        search_id=str(cache.id),
        session_id=session_id,
        mode=cache.mode,
        page=1,
        page_size=page_size,
        total_products=len(variant_ids),
        has_more=len(variant_ids) > page_size,
        products=products,
    )


# ------------------------------------------------------------
# 2) Similar products
# ------------------------------------------------------------

@router.get("/similar/product/{product_id}", response_model=CachedSearchResponse)
def similar_products(
    product_id: int,
    variant_id: Optional[int] = Query(None),
    k_images: int = Query(2000, ge=100, le=5000),
    max_products: int = Query(3000, ge=100, le=10000),
    page_size: int = Query(50, ge=10, le=100),
    ttl_minutes: int = Query(20, ge=5, le=43200),
    db: Session = Depends(get_db),
):
    row = db.execute(
        select(VariantEmbedding.fused_embedding, VariantEmbedding.model_name, VariantEmbedding.variant_id)
        .join(ProductVariant, ProductVariant.id == VariantEmbedding.variant_id)
        .where(
            ProductVariant.product_id == product_id,
            VariantEmbedding.fused_embedding.isnot(None),
        )
        .order_by(
            text("CASE WHEN variant_embedding.variant_id = :variant_id THEN 0 ELSE 1 END"),
            VariantEmbedding.variant_id.asc(),
        )
        .limit(1)
    , {"variant_id": variant_id or -1}).first()

    if not row or row[0] is None:
        raise HTTPException(status_code=404, detail="No variant embedding found for this product.")

    emb_vec = list(row[0])
    model_name = row[1]
    seed_variant_id = int(row[2])

    hits = ann_variants_with_scores(db, emb_vec, model_name, k_images, embedding_field="fused_embedding")
    top = [(vid, pid, score) for vid, pid, score in hits if vid != seed_variant_id][:max_products]
    variant_ids = [vid for vid, _, _ in top]
    product_ids = [pid for _, pid, _ in top]
    scores = [float(score) for _, _, score in top]

    cache = create_cache(
        db,
        product_ids=product_ids,
        variant_ids=variant_ids,
        scores=scores,
        mode="similar_product",
        ttl_minutes=ttl_minutes,
        meta={
            "model_name": model_name,
            "seed_product_id": product_id,
            "seed_variant_id": seed_variant_id,
            "k_images": k_images,
            "max_products": max_products,
        },
    )

    score_by_variant_id = {variant_id: float(score) for variant_id, score in zip(variant_ids, scores)}
    products = hydrate_variant_cards(db, top[:page_size], score_by_variant_id)
    return CachedSearchResponse(
        search_id=str(cache.id),
        mode=cache.mode,
        page=1,
        page_size=page_size,
        total_products=len(variant_ids),
        has_more=len(variant_ids) > page_size,
        products=products,
    )


# ------------------------------------------------------------
# 3) Log search events
# ------------------------------------------------------------

@router.post("/events", response_model=OkResponse)
def log_search_event(
    payload: LogSearchEventRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    session = db.get(SearchSession, payload.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Search session not found.")
    if session.user_id is not None:
        if user is None or user.id != session.user_id:
            raise HTTPException(status_code=403, detail="Not allowed to write to this search session.")

    ev = SearchEvent(
        session_id=payload.session_id,
        user_id=(user.id if user else session.user_id),
        event_type=payload.event_type,
        product_id=payload.product_id,
        variant_id=payload.variant_id,
        position=payload.position,
        impression_key=payload.impression_key,
    )
    db.add(ev)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    except Exception:
        db.rollback()
        raise
    return OkResponse(ok=True)


# ------------------------------------------------------------
# 4) Closet recommendations
# ------------------------------------------------------------

@router.get("/closet/{closet_id}/recommendations", response_model=CachedSearchResponse)
def recommend_for_closet(
    closet_id: int,
    k_images: int = Query(3000, ge=100, le=5000),
    max_products: int = Query(3000, ge=100, le=10000),
    page_size: int = Query(50, ge=10, le=100),
    ttl_minutes: int = Query(30, ge=5, le=43200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_closet_access(db, closet_id, user.id)
    items = db.query(ClosetItem).filter(ClosetItem.closet_id == closet_id).all()
    if not items:
        raise HTTPException(status_code=400, detail="Closet is empty.")

    seed_variant_ids = [int(i.variant_id) for i in items if i.variant_id is not None]
    if not seed_variant_ids:
        seed_variant_ids = [
            int(v_id)
            for (v_id,) in db.query(ProductVariant.id)
            .filter(ProductVariant.product_id.in_([int(i.product_id) for i in items if i.product_id is not None]))
            .limit(300)
            .all()
        ]
    if not seed_variant_ids:
        raise HTTPException(status_code=400, detail="Closet has no variants.")

    rows = db.execute(
        select(VariantEmbedding.fused_embedding, VariantEmbedding.model_name)
        .where(
            VariantEmbedding.variant_id.in_(seed_variant_ids),
            VariantEmbedding.fused_embedding.isnot(None),
        )
        .limit(300)
    ).all()

    vecs: List[np.ndarray] = []
    model_name: Optional[str] = None
    for emb, m in rows:
        if emb is None:
            continue
        model_name = model_name or m
        vecs.append(np.array(list(emb), dtype=np.float32))

    if not vecs or not model_name:
        raise HTTPException(status_code=404, detail="No embeddings found for closet variants.")

    mean_vec = l2_normalize_np(np.mean(np.stack(vecs, axis=0), axis=0))
    hits = ann_variants_with_scores(db, mean_vec.tolist(), model_name, k_images, embedding_field="fused_embedding")

    existing = set(seed_variant_ids)
    top = [(vid, pid, score) for vid, pid, score in hits if vid not in existing][:max_products]
    variant_ids = [vid for vid, _, _ in top]
    reco_ids = [pid for _, pid, _ in top]
    scores = [float(score) for _, _, score in top]

    cache = create_cache(
        db,
        product_ids=reco_ids,
        variant_ids=variant_ids,
        scores=scores,
        mode="closet_reco",
        ttl_minutes=ttl_minutes,
        meta={
            "model_name": model_name,
            "closet_id": closet_id,
            "k_images": k_images,
            "max_products": max_products,
            "seed_count": len(existing),
        },
    )

    score_by_variant_id = {variant_id: float(score) for variant_id, score in zip(variant_ids, scores)}
    products = hydrate_variant_cards(db, top[:page_size], score_by_variant_id)
    return CachedSearchResponse(
        search_id=str(cache.id),
        mode=cache.mode,
        page=1,
        page_size=page_size,
        total_products=len(variant_ids),
        has_more=len(variant_ids) > page_size,
        products=products,
    )


# ------------------------------------------------------------
# 5) Recent searches (SIGNED-IN ONLY)
# Replay uses SearchSession.result_cache_id (no ANN rerun)
# ------------------------------------------------------------

@router.get("/recent", response_model=List[RecentSearchItemOut])
def get_recent_searches(
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cutoff = utc_now_naive() - timedelta(days=RECENT_RETENTION_DAYS)

    sessions = (
        db.query(SearchSession)
        .filter(SearchSession.user_id == user.id, SearchSession.created_at >= cutoff)
        .order_by(SearchSession.created_at.desc())
        .limit(limit)
        .all()
    )

    out: List[RecentSearchItemOut] = []
    for s in sessions:
        img_url = None
        if s.query_image_id:
            img = db.get(Image, s.query_image_id)
            img_url = img.url if img else None

        out.append(
            RecentSearchItemOut(
                id=s.id,
                search_id=str(s.result_cache_id) if s.result_cache_id else None,
                mode=s.mode,
                query_text=s.query_text,
                query_image_url=img_url,
                created_at=s.created_at,
            )
        )
    return out


@router.delete("/recent/{session_id}", response_model=OkResponse)
def delete_recent_search(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = db.get(SearchSession, session_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(status_code=404, detail="Recent search not found.")

    cache_id = s.result_cache_id
    qimg_id = s.query_image_id

    db.delete(s)
    db.commit()

    # delete cache if unused by any other sessions
    try:
        delete_cache_if_unreferenced(db, cache_id)
    except Exception:
        db.rollback()

    # delete query preview image stub if it's not tied to a product
    if qimg_id is not None:
        img = db.get(Image, qimg_id)
        if img is not None and img.product_id is None:
            try:
                db.delete(img)
                db.commit()
            except Exception:
                db.rollback()

    return OkResponse(ok=True)


@router.delete("/recent", response_model=OkResponse)
def clear_recent_searches(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sessions = db.query(SearchSession).filter(SearchSession.user_id == user.id).all()
    cache_ids = [s.result_cache_id for s in sessions if s.result_cache_id is not None]
    qimg_ids = [s.query_image_id for s in sessions if s.query_image_id is not None]

    db.query(SearchSession).filter(SearchSession.user_id == user.id).delete(synchronize_session=False)
    db.commit()

    if cache_ids:
        for cache_id in cache_ids:
            try:
                delete_cache_if_unreferenced(db, cache_id)
            except Exception:
                db.rollback()

    if qimg_ids:
        try:
            imgs = db.query(Image).filter(Image.id.in_(qimg_ids)).all()
            for img in imgs:
                if img.product_id is None:
                    db.delete(img)
            db.commit()
        except Exception:
            db.rollback()

    return OkResponse(ok=True)
