"""
Production-grade Musinsa ingestion pipeline.
Combines the Playwright Scraper with the Union-Find DB backfiller.
Features:
- Rotating JSON Logging
- Checkpointing (safe restarts)
- Memory Purging via batch streaming
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Dict, Any
import asyncio

from logging.handlers import RotatingFileHandler
from backend.scraper.musinsa_scaper.full_scraper import MusinsaScraper
from backend.db.utils.backfill_musinsa_data import import_musinsa_products

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

        # attach metadata natively
        for key in (
            "category_code", "page", "batch_size", "items_processed"
        ):
            if hasattr(record, key):
                base[key] = getattr(record, key)

        if record.exc_info:
            base["exc"] = self.formatException(record.exc_info)

        return json.dumps(base, ensure_ascii=False)


def init_logger(
    *,
    run_id: str,
    log_dir: str = "backend/logs/ingestion",
    level: str = "INFO",
) -> logging.Logger:
    os.makedirs(log_dir, exist_ok=True)
    logger = logging.getLogger("musinsa_ingestion")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    logger.propagate = False

    if logger.handlers:
        return logger

    # quiet noisy libs
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)
    
    # Console Handler
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(getattr(logging, level.upper(), logging.INFO))
    ch.setFormatter(logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    ))
    logger.addHandler(ch)

    # File Handler
    fname = os.path.join(log_dir, f"musinsa_pipeline_{run_id}.log")
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
    category: str
    page: int
    updated_at_utc: str

    @staticmethod
    def default() -> "Checkpoint":
        """If no checkpoint exists, start at the beginning of Musinsa categories."""
        return Checkpoint(
            category="",
            page=1,
            updated_at_utc=datetime.now(timezone.utc).isoformat(),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category,
            "page": self.page,
            "updated_at_utc": self.updated_at_utc,
        }

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "Checkpoint":
        return Checkpoint(
            category=str(d.get("category", "")),
            page=int(d.get("page", 1)),
            updated_at_utc=str(d.get("updated_at_utc", "")) or datetime.now(timezone.utc).isoformat(),
        )

def load_checkpoint(path: str, logger: logging.Logger) -> Checkpoint:
    if not os.path.exists(path):
        cp = Checkpoint.default()
        logger.info("No checkpoint found; starting fresh", extra={"checkpoint_path": path})
        return cp
    try:
        with open(path, "r") as f:
            d = json.load(f)
        cp = Checkpoint.from_dict(d)
        logger.info(
            "Loaded checkpoint",
            extra={"checkpoint_path": path, "category_code": cp.category, "page": cp.page},
        )
        return cp
    except Exception:
        logger.error("Failed to load checkpoint; starting fresh", extra={"checkpoint_path": path}, exc_info=True)
        return Checkpoint.default()

def save_checkpoint(path: str, cp: Checkpoint, logger: logging.Logger) -> None:
    try:
        cp.updated_at_utc = datetime.now(timezone.utc).isoformat()
        tmp = path + ".tmp"
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(tmp, "w") as f:
            json.dump(cp.to_dict(), f, indent=2)
        os.replace(tmp, path)
        logger.info("Checkpoint saved", extra={"checkpoint_path": path, "category_code": cp.category, "page": cp.page})
    except Exception:
        logger.error("Failed to save checkpoint", extra={"checkpoint_path": path}, exc_info=True)


# -----------------------------
# Pipeline Orchestrator
# -----------------------------

async def run_pipeline(checkpoint_path: str, headless: bool, limit: int, max_pages: int, wipe: bool):
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    logger = init_logger(run_id=run_id)
    
    logger.info("Initializing Musinsa Ingestion Pipeline.")
    
    cp = load_checkpoint(checkpoint_path, logger)
    start_cat = cp.category if cp.category else None
    start_page = cp.page

    # Auto-Toggle wiping. Only wipe during the very FIRST initialization.
    is_first_run = wipe and (start_cat is None and start_page <= 1)
    
    # State tracking closure
    wipe_tracker = {"should_wipe": is_first_run}

    def on_batch_ready_hook(products_batch: list[dict], category_code: str, page_num: int):
        """Callback fired dynamically from the Scraper whenever a chunk memory threshold is met."""
        logger.info(
            f"Callback Triggered: Ingesting {len(products_batch)} products "
            f"(Cat: {category_code}, Page: {page_num})",
            extra={"category_code": category_code, "page": page_num, "batch_size": len(products_batch)}
        )
        
        try:
            import_musinsa_products(products_batch, wipe_existing=wipe_tracker["should_wipe"])
            
            # Switch wipe flag safely after the primary database wipe
            if wipe_tracker["should_wipe"]:
                wipe_tracker["should_wipe"] = False
                
            # Secure global state
            cp.category = category_code
            cp.page = page_num + 1 # Next checkpoint starts on the following page cleanly
            save_checkpoint(checkpoint_path, cp, logger)
            
        except Exception as e:
            logger.error(f"FATAL: Database injection failed for Category {category_code} Page {page_num}. Terminating to preserve checkpoint.")
            raise e

    # Initialize Scraper
    scraper = MusinsaScraper(
        headless=headless,
        category_limit=limit,
        max_listing_pages=max_pages,
        verbose=False,
    )
    
    logger.info(f"Triggering Scraper... (Start Category: {start_cat}, Start Page: {start_page})")
    
    try:
        await scraper.run(
            start_category=start_cat,
            start_page=start_page,
            on_batch_ready=on_batch_ready_hook
        )
        logger.info("Full Ingestion Pipeline Completed Natively.")
    except Exception as e:
        logger.error(f"Scraper execution was interrupted: {e}")
        raise e


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Full Automated Pipeline for Musinsa Scraper")
    parser.add_argument("--checkpoint-path", type=str, default="backend/logs/ingestion/checkpoint.json")
    parser.add_argument("--headless", action="store_true", help="Run scraper visually")
    parser.add_argument("--limit", type=int, default=500, help="Category product limit")
    parser.add_argument("--max-pages", type=int, default=300, help="Max pages per category")
    parser.add_argument("--wipe", action="store_true", help="Wipe existing products on initial pass")
    
    args = parser.parse_args()
    
    asyncio.run(
        run_pipeline(
            checkpoint_path=args.checkpoint_path,
            headless=args.headless,
            limit=args.limit,
            max_pages=args.max_pages,
            wipe=args.wipe
        )
    )
