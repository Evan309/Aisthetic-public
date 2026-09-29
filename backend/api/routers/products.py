from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func, desc, asc
from typing import Optional
import time

from api.schemas import (
    Product,
    ProductListItem,
    ProductListResponse,
)
from api.dependencies import get_db
from db.models import (
    Product as ProductModel,
    Category,
    Brand,
    Retailer,
    Image,
    ProductVariant,
    PriceHistory
)
from middleware.rate_limit import limiter

router = APIRouter(prefix="/products", tags=["products"])

# =====================================================
# 🔥 IN-MEMORY CACHE (10 minutes)
# =====================================================

PRODUCT_CACHE = {}
CACHE_TTL = 600  # 10 minutes


def cache_key(params: dict):
    return "|".join(f"{k}:{v}" for k, v in sorted(params.items()))


# =====================================================
# 🔥 UTIL — PREVENT N+1 QUERIES: preload price, images, brand, category
# =====================================================

def get_latest_price_subquery(db: Session):
    """Returns a subquery that gives the latest price for each product."""
    latest_time = (
        db.query(
            PriceHistory.product_id,
            func.max(PriceHistory.scraped_at).label("max_time")
        )
        .group_by(PriceHistory.product_id)
        .subquery()
    )

    latest_price = (
        db.query(PriceHistory)
        .join(
            latest_time,
            and_(
                PriceHistory.product_id == latest_time.c.product_id,
                PriceHistory.scraped_at == latest_time.c.max_time
            )
        )
        .subquery()
    )
    return latest_price


# =====================================================
# 🔥 Convert model → list item WITHOUT extra queries
# =====================================================

def product_to_list_item_optimized(
    product: ProductModel,
    regular_price: Optional[float],
    sale_price: Optional[float],
    discount_rate: Optional[float],
    currency: Optional[str],
) -> ProductListItem:
    # Decide which price to show
    if sale_price is not None:
        price = sale_price
        original = regular_price
    else:
        price = regular_price
        original = None

    primary_image = product.images[0].url if product.images else None

    category_name = (
        f"{product.category.main} - {product.category.sub}"
        if product.category else None
    )

    return ProductListItem(
        id=product.id,
        name=product.name or "",
        price=price,
        originalPrice=original,
        image=primary_image,
        description=product.description,
        category=category_name,
        brand=product.brand.name if product.brand else None,
        inStock=product.is_available,
        rating=None,
        reviewCount=None,
    )


# =====================================================
# 🔥 MAIN LIST ROUTE (WITH CACHING + OPTIMIZED QUERY)
# =====================================================

@router.get("", response_model=ProductListResponse)
@limiter.limit("120/minute")
def get_products(
    request: Request,
    search: str | None = Query(None),
    category: str | None = Query(None),
    main_category: str | None = Query(None),
    sub_category: str | None = Query(None),
    gender: str | None = Query(None),
    brand: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    # --------------------------------------
    # 🔥 CACHE CHECK
    # --------------------------------------
    params = {
        "search": search,
        "category": category,
        "main_category": main_category,
        "sub_category": sub_category,
        "gender": gender,
        "brand": brand,
        "page": page,
        "limit": limit,
    }

    # If it's a "browse" query (no search/filter), we might want to just return global min/max
    # But for now, let's calculate it dynamically based on the filters provided (except price).

    key = cache_key(params)
    now = time.time()

    if key in PRODUCT_CACHE:
        cached = PRODUCT_CACHE[key]
        if now - cached["timestamp"] < CACHE_TTL:
            return cached["data"]

    # --------------------------------------
    # 🔥 BASE QUERY (uses joinedload to avoid N+1 queries)
    # --------------------------------------

    price_subq = get_latest_price_subquery(db)

    # Explicitly select only the columns we care about from the price subquery
    query = (
        db.query(
            ProductModel,
            price_subq.c.regular_price.label("regular_price"),
            price_subq.c.sale_price.label("sale_price"),
            price_subq.c.discount_rate.label("discount_rate"),
            price_subq.c.currency.label("currency"),
        )
        .outerjoin(price_subq, ProductModel.id == price_subq.c.product_id)
        .options(
            joinedload(ProductModel.brand),
            joinedload(ProductModel.category),
            joinedload(ProductModel.images)
        )
    )

    # --------------------------------------
    # 🔥 Filters
    # --------------------------------------

    if search:
        term = f"%{search.lower()}%"
        query = (
            query.join(Brand, ProductModel.brand_id == Brand.id, isouter=True)
            .filter(
                or_(
                    func.lower(ProductModel.name).like(term),
                    func.lower(ProductModel.description).like(term),
                    func.lower(Brand.name).like(term),
                )
            )
        )

    if main_category or sub_category:
        query = query.join(Category, ProductModel.category_id == Category.id)
        if main_category:
            query = query.filter(func.lower(Category.main) == main_category.lower())
        if sub_category:
            query = query.filter(func.lower(Category.sub) == sub_category.lower())

    elif category:
        query = (
            query.join(Category, ProductModel.category_id == Category.id)
            .filter(
                or_(
                    func.lower(Category.main).like(f"%{category.lower()}%"),
                    func.lower(Category.sub).like(f"%{category.lower()}%"),
                )
            )
        )

    if gender:
        query = query.filter(func.lower(ProductModel.gender) == gender.lower())

    if brand:
        query = (
            query.join(Brand, ProductModel.brand_id == Brand.id)
            .filter(func.lower(Brand.name).like(f"%{brand.lower()}%"))
        )

    query = query.order_by(asc(ProductModel.name))

    # --------------------------------------
    # 🔥 Pagination
    # --------------------------------------
    total = query.count()
    offset = (page - 1) * limit
    rows = query.offset(offset).limit(limit).all()

    # Convert rows → list items
    products = []
    for product, regular_price, sale_price, discount_rate, currency in rows:
        products.append(
            product_to_list_item_optimized(
                product,
                regular_price,
                sale_price,
                discount_rate,
                currency,
            )
        )

    response = ProductListResponse(
        products=products,
        total=total,
        page=page,
        limit=limit,
        total_pages=(total + limit - 1) // limit,
    )

    # --------------------------------------
    # 🔥 SAVE TO CACHE (WITH LIMIT)
    # --------------------------------------
    if len(PRODUCT_CACHE) > 1000:
        PRODUCT_CACHE.clear()

    PRODUCT_CACHE[key] = {"data": response, "timestamp": now}

    return response


# =====================================================
# 🔥 PRODUCT DETAIL (optimized)
# =====================================================
@router.get("/{product_id}", response_model=Product)
@limiter.limit("120/minute")
def get_product(request: Request, product_id: int, db: Session = Depends(get_db)):

    product = (
        db.query(ProductModel)
        .options(
            joinedload(ProductModel.brand),
            joinedload(ProductModel.category),
            joinedload(ProductModel.retailer),
            joinedload(ProductModel.images),
            joinedload(ProductModel.variants),
        )
        .filter(ProductModel.id == product_id)
        .first()
    )

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    price_subq = get_latest_price_subquery(db)

    price_row = (
        db.query(
            price_subq.c.regular_price.label("regular_price"),
            price_subq.c.sale_price.label("sale_price"),
            price_subq.c.discount_rate.label("discount_rate"),
            price_subq.c.currency.label("currency"),
        )
        .filter(price_subq.c.product_id == product_id)
        .first()
    )

    if price_row:
        regular_price, sale_price, discount_rate, currency = price_row
        price_info = {
            "regular_price": regular_price,
            "sale_price": sale_price,
            "discount_rate": discount_rate,
            "currency": currency,
        }
    else:
        regular_price = sale_price = discount_rate = currency = None
        price_info = None

    if sale_price is not None:
        price = sale_price
        original = regular_price
    else:
        price = regular_price
        original = None

    primary_image = product.images[0].url if product.images else None
    images_list = [img.url for img in product.images]

    category_name = (
        f"{product.category.main} - {product.category.sub}"
        if product.category else None
    )

    return Product(
        id=product.id,
        name=product.name,
        description=product.description,
        url=product.url,
        gender=product.gender,
        is_available=product.is_available,
        brand=product.brand,
        category=product.category,
        retailer=product.retailer,
        images=product.images,
        variants=product.variants,
        price_info=price_info,
        price=price,
        originalPrice=original,
        image=primary_image,
        images_list=images_list,
        category_name=category_name,
        brand_name=product.brand.name if product.brand else None,
        inStock=product.is_available,
        rating=None,
        reviewCount=None,
    )
