from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, desc, asc, text
from typing import Optional
from math import ceil
import time

from api.dependencies import get_db
from api.schemas import BrandWithImage, BrandListResponse
from db.models import Brand, Product, Image, PriceHistory
from middleware.rate_limit import limiter
from fastapi.requests import Request

router = APIRouter(prefix="/brands", tags=["brands"])

# ============================================
# 🔥 In-memory Cache (10min)
# ============================================

BRAND_CACHE = {}
CACHE_TTL = 600


def cache_key(params: dict):
    return "|".join(f"{k}:{v}" for k, v in sorted(params.items()))
    

# ============================================
# 🔥 Helper — Representative image per brand
# ============================================

def build_brand_image_subquery(db: Session):
    """
    Use DISTINCT ON to pick ONE image per brand (the newest product image).
    """
    latest_price = (
        db.query(
            PriceHistory.product_id.label("pid"),
            func.max(PriceHistory.scraped_at).label("latest_time")
        )
        .group_by(PriceHistory.product_id)
        .subquery()
    )

    # DISTINCT ON: Select one image per brand (Postgres feature)
    brand_img = (
        db.query(
            Product.brand_id.label("brand_id"),
            Image.url.label("image")
        )
        .join(latest_price, latest_price.c.pid == Product.id)
        .join(Image, Image.product_id == Product.id)
        .distinct(Product.brand_id)  # 🚀 picks the first row for each brand
        .order_by(Product.brand_id, Image.url)  # required ordering for DISTINCT ON
        .subquery()
    )

    return brand_img



# ============================================
# 🔥 GET ALL BRANDS (full page)
# ============================================

@router.get("", response_model=BrandListResponse)
@limiter.limit("30/minute")
def get_brands(
    request: Request,
    search: Optional[str] = Query(None),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    include_counts: bool = Query(True),
    include_images: bool = Query(True),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    db: Session = Depends(get_db)
):

    params = {
        "search": search,
        "sort_by": sort_by,
        "sort_order": sort_order,
        "include_counts": include_counts,
        "include_images": include_images,
        "page": page,
        "limit": limit,
    }

    key = cache_key(params)
    now = time.time()

    if key in BRAND_CACHE:
        cached = BRAND_CACHE[key]
        if now - cached["timestamp"] < CACHE_TTL:
            return cached["data"]

    query = db.query(Brand)

    # Search
    if search:
        term = f"%{search.lower()}%"
        query = query.filter(func.lower(Brand.name).like(term))

    # Sorting
    sort_col = Brand.name if sort_by == "name" else Brand.id
    query = query.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))

    # Pagination
    total = query.count()
    offset = (page - 1) * limit
    brands = query.offset(offset).limit(limit).all()

    # Product counts
    if include_counts:
        counts = dict(
            db.query(Product.brand_id, func.count(Product.id))
            .group_by(Product.brand_id)
            .all()
        )
    else:
        counts = {}

    # Representative images
    brand_img_subq = build_brand_image_subquery(db)
    img_map = dict(
        db.query(brand_img_subq.c.brand_id, brand_img_subq.c.image).all()
    ) if include_images else {}

    items = [
        BrandWithImage(
            id=b.id,
            name=b.name,
            productCount=counts.get(b.id, 0),
            image=img_map.get(b.id)
        )
        for b in brands
    ]

    response = BrandListResponse(
        brands=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit
    )

    BRAND_CACHE[key] = {"data": response, "timestamp": now}
    return response


# ============================================
# 🔥 FEATURED BRANDS (for homepage)
# ============================================

@router.get("/featured", response_model=list[BrandWithImage])
@limiter.limit("30/minute")
def get_featured_brands(
    request: Request,
    limit: int = Query(6, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Returns X brands with 1 image each — optimized for homepage sections.
    """

    # Get brands ordered by most products
    brand_counts = (
        db.query(
            Brand.id,
            Brand.name,
            func.count(Product.id).label("cnt")
        )
        .join(Product, Product.brand_id == Brand.id)
        .group_by(Brand.id)
        .order_by(desc("cnt"))
        .limit(limit)
        .all()
    )

    brand_ids = [b.id for b in brand_counts]

    # Representative images subquery
    brand_img_subq = build_brand_image_subquery(db)
    img_map = dict(
        db.query(brand_img_subq.c.brand_id, brand_img_subq.c.image)
        .filter(brand_img_subq.c.brand_id.in_(brand_ids))
        .all()
    )

    return [
        BrandWithImage(
            id=b.id,
            name=b.name,
            productCount=b.cnt,
            image=img_map.get(b.id)
        )
        for b in brand_counts
    ]


# ============================================
# 🔥 GET SINGLE BRAND (optimized)
# ============================================

@router.get("/{brand_id}", response_model=BrandWithImage)
@limiter.limit("60/minute")
def get_brand_by_id(
    request: Request,
    brand_id: int,
    db: Session = Depends(get_db)
):
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    # Get product count
    count = db.query(func.count(Product.id)).filter(Product.brand_id == brand_id).scalar() or 0

    # Get representative image
    brand_img_subq = build_brand_image_subquery(db)
    image = db.query(brand_img_subq.c.image).filter(brand_img_subq.c.brand_id == brand_id).scalar()

    return BrandWithImage(
        id=brand.id,
        name=brand.name,
        productCount=count,
        image=image
    )


# ============================================
# ✅ GET BRAND PRODUCTS (paginated)
# ============================================

@router.get("/{brand_id}/products")
@limiter.limit("30/minute")
def get_brand_products(
    request: Request,
    brand_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(48, ge=1, le=200),
    sort_by: str = Query("name"),          # name | price
    sort_order: str = Query("asc"),        # asc | desc
    db: Session = Depends(get_db),
):
    # --- brand (for display) ---
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        return {"products": [], "total": 0, "page": page, "limit": limit, "total_pages": 0}

    # --- latest price per product ---
    latest_price_time = (
        db.query(
            PriceHistory.product_id.label("pid"),
            func.max(PriceHistory.scraped_at).label("latest_time"),
        )
        .group_by(PriceHistory.product_id)
        .subquery()
    )

    # --- latest price per product ---
    latest_price_subq = (
        db.query(PriceHistory)
        .join(
            latest_price_time,
            (PriceHistory.product_id == latest_price_time.c.pid)
            & (PriceHistory.scraped_at == latest_price_time.c.latest_time),
        )
        .subquery()
    )
    latest_price = aliased(PriceHistory, latest_price_subq)

    # --- pick ONE image per product (first url) ---
    product_image = (
        db.query(
            Image.product_id.label("pid"),
            func.min(Image.url).label("image"),
        )
        .group_by(Image.product_id)
        .subquery()
    )

    # --- base query ---
    q = (
        db.query(Product, latest_price, product_image.c.image)
        .outerjoin(latest_price, latest_price.product_id == Product.id)
        .outerjoin(product_image, product_image.c.pid == Product.id)
        .filter(Product.brand_id == brand_id)
    )

    total = q.count()

    # --- sorting ---
    order_fn = asc if sort_order.lower() == "asc" else desc
    if sort_by == "price":
        # try common column names; fall back safely
        price_col = None
        for col_name in ["price", "current_price", "sale_price"]:
            if hasattr(latest_price, col_name):
                price_col = getattr(latest_price, col_name)
                break
        q = q.order_by(order_fn(price_col) if price_col is not None else order_fn(Product.name))
    else:
        q = q.order_by(order_fn(Product.name))

    # --- pagination ---
    offset = (page - 1) * limit
    rows = q.offset(offset).limit(limit).all()

    products_out = []
    for prod, price_row, img_url in rows:
        # best-effort mapping (works even if some fields aren't present)
        # price + originalPrice
        price_val = None
        original_val = None

        if price_row is not None:
            for col_name in ["price", "current_price", "sale_price"]:
                if hasattr(price_row, col_name):
                    price_val = getattr(price_row, col_name)
                    break
            for col_name in ["original_price", "msrp", "list_price"]:
                if hasattr(price_row, col_name):
                    original_val = getattr(price_row, col_name)
                    break

        products_out.append(
            {
                "id": getattr(prod, "id", None),
                "name": getattr(prod, "name", None),
                "price": price_val,
                "originalPrice": original_val,
                "image": img_url,
                "description": getattr(prod, "description", None),
                "category": getattr(prod, "category", None) or getattr(prod, "category_name", None),
                "brand": getattr(brand, "name", None),
                "inStock": getattr(prod, "in_stock", None) if hasattr(prod, "in_stock") else getattr(prod, "inStock", None),
                "rating": getattr(prod, "rating", None),
                "reviewCount": getattr(prod, "review_count", None) if hasattr(prod, "review_count") else getattr(prod, "reviewCount", None),
                "tags": getattr(prod, "tags", None),
            }
        )

    total_pages = int(ceil(total / limit)) if limit else 0
    return {
        "products": products_out,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
    }
