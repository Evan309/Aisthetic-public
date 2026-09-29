from fastapi import APIRouter, Depends, Request
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import Session
from typing import List
import time

from api.schemas import CategoryResponse
from api.dependencies import get_db
from db.models import Category as CategoryModel
from db.session import is_transient_db_error, run_with_db_retry
from middleware.rate_limit import limiter

router = APIRouter(prefix="/categories", tags=["categories"])

# ============================================
# 🔥 In-memory cache for all category endpoints
# ============================================

CACHE_TTL = 3600  # 1 hour — safe because categories rarely change
CATEGORY_CACHE = {}
MAIN_CACHE = {}
SUB_CACHE = {}
STARTUP_LOADED = False


def cache_get(key, store):
    now = time.time()
    if key in store and now - store[key]["ts"] < CACHE_TTL:
        return store[key]["data"]
    return None


def cache_set(key, value, store):
    store[key] = {"data": value, "ts": time.time()}
    return value


# ============================================
# 🔥 Get ALL categories (main + sub)
# ============================================
@router.get("", response_model=List[CategoryResponse])
@limiter.limit("60/minute")
def get_categories(
    request: Request,
    db: Session = Depends(get_db)
):
    cached = cache_get("all_categories", CATEGORY_CACHE)
    if cached:
        return cached

    try:
        categories = run_with_db_retry(
            db,
            lambda: (
                db.query(CategoryModel)
                .order_by(CategoryModel.main, CategoryModel.sub)
                .all()
            ),
            retries=1,
        )
    except (OperationalError, DBAPIError) as exc:
        if cached and is_transient_db_error(exc):
            return cached
        raise

    seen = set()
    result = []

    # Add "All" option
    result.append(CategoryResponse(id="all", name="All", slug="all"))

    # Store main categories temporarily
    main_categories = {}

    for cat in categories:
        main = cat.main
        sub = cat.sub

        # Add main category once
        main_key = f"main_{main}"
        if main_key not in seen:
            seen.add(main_key)
            main_categories[main] = CategoryResponse(
                id=f"main_{main.lower().replace(' ', '_')}",
                name=main,
                slug=main.lower().replace(' ', '_')
            )

        # Add subcategory
        sub_key = f"{main}_{sub}"
        if sub_key not in seen:
            seen.add(sub_key)
            result.append(
                CategoryResponse(
                    id=f"{main.lower().replace(' ', '_')}_{sub.lower().replace(' ', '_')}",
                    name=sub,
                    slug=sub.lower().replace(' ', '_'),
                    parentId=f"main_{main.lower().replace(' ', '_')}",
                )
            )

    # Insert main categories (after "All")
    for main_cat in main_categories.values():
        if main_cat.id not in [r.id for r in result]:
            result.insert(1, main_cat)

    return cache_set("all_categories", result, CATEGORY_CACHE)


# ============================================
# 🔥 Get MAIN categories (faster, cached)
# ============================================
@router.get("/main", response_model=List[str])
@limiter.limit("60/minute")
def get_main_categories(
    request: Request,
    db: Session = Depends(get_db)
):
    cached = cache_get("main", MAIN_CACHE)
    if cached:
        return cached

    try:
        rows = run_with_db_retry(
            db,
            lambda: (
                db.query(CategoryModel.main)
                .distinct()
                .order_by(CategoryModel.main)
                .all()
            ),
            retries=1,
        )
    except (OperationalError, DBAPIError) as exc:
        if cached and is_transient_db_error(exc):
            return cached
        raise
    res = [r[0] for r in rows]

    return cache_set("main", res, MAIN_CACHE)


# ============================================
# 🔥 Get SUB categories for a given main (cached per main)
# ============================================
@router.get("/main/{main_category}/sub", response_model=List[str])
@limiter.limit("60/minute")
def get_sub_categories(
    request: Request,
    main_category: str,
    db: Session = Depends(get_db)
):
    cached = cache_get(main_category, SUB_CACHE)
    if cached:
        return cached

    try:
        rows = run_with_db_retry(
            db,
            lambda: (
                db.query(CategoryModel.sub)
                .filter(CategoryModel.main == main_category)
                .distinct()
                .order_by(CategoryModel.sub)
                .all()
            ),
            retries=1,
        )
    except (OperationalError, DBAPIError) as exc:
        if cached and is_transient_db_error(exc):
            return cached
        raise
    res = [r[0] for r in rows]

    return cache_set(main_category, res, SUB_CACHE)
