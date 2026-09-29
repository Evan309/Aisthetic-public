import pandas as pd
from sqlalchemy.exc import IntegrityError
from backend.db.session import SessionLocal
from backend.db.models import (
    Retailer,
    Brand,
    Category,
    Product,
    ProductVariant,
    PriceHistory,
    Image
)
from backend.utils.category_mapper import CategoryMapper

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mapper = CategoryMapper()

def get_or_create(session, model, defaults=None, **kwargs):
    instance = session.query(model).filter_by(**kwargs).first()
    if instance:
        return instance

    params = defaults or {}
    params.update(kwargs)
    instance = model(**params)
    session.add(instance)

    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return session.query(model).filter_by(**kwargs).first()

    return instance

def import_musinsa(path: str):
    logger.info(f"loading Musinsa CSV: {path}")
    df = pd.read_csv(path)

    db = SessionLocal()

    retailer = get_or_create(
        db,
        Retailer,
        slug="musinsa",
        defaults={
            "name": "Musinsa",
            "site_url": "https://global.musinsa.com",
            "currency": "USD",
        },
    )
    logger.info(f"Retailer: {retailer.name} (id={retailer.id})")

    count = 0

    for _, row in df.iterrows():
        product_name = row["product_name"]
         
        try:
            cat = mapper.normalize(product_name)
            cat_main = cat.get("category_main")
            cat_sub = cat.get("category_sub")
            gender = cat.get("gender", "unisex")
        except Exception:
            cat_main, cat_sub, gender = None, None, "unisex"

        category = None
        if cat_main and cat_sub:
            category = get_or_create(
                db,
                Category,
                main=cat_main,
                sub=cat_sub,
            )
        
        brand_name = row["brand"].strip()
        brand = get_or_create(db, Brand, name=brand_name)

        product = get_or_create(
            db,
            Product,
            retailer_id=retailer.id,
            retailer_product_id=str(row["product_id"]),
            defaults={
                "brand_id": brand.id,
                "category_id": category.id if category else None,
                "name": product_name,
                "description": None,
                "url": row["link"],
                "gender": gender,
                "is_available": True,
            }
        )

        variant = ProductVariant(
            product_id=product.id,
            sku=str(row["product_id"]),
            color=None,
            size=None,
            material=None,
            image_url=row["image"],
            stock_status="in_stock",
            source_name="musinsa",
            source_variant_id=str(row["product_id"]),
            source_payload_version="csv_v1",
        )
        db.add(variant)

        price_entry = PriceHistory(
            product_id=product.id,
            currency="USD",
            regular_price=row["original_price"],
            sale_price=row["price"],
            discount_rate=None if row["discount_rate"] == "(not set)" else row["discount_rate"],
        )
        db.add(price_entry)

        image_entry = Image(
            product_id=product.id,
            variant_id=None,
            url=row["image"],
        )
        db.add(image_entry)

        count += 1
        if count % 100 == 0:
            db.commit()
            logger.info(f"Inserted {count} products...")

    db.commit()
    logger.info(f"Import complete: {count} Musinsa products loaded.")


if __name__ == "__main__":
    import_musinsa("backend/data/product_catalog/musinsa_products/musinsa_clothing_20251105_154637.csv")
