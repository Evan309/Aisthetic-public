import json
import logging
import argparse
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any

from backend.db.session import SessionLocal
from backend.db.models import (
    Retailer,
    Brand,
    Product,
    ProductVariant,
    PriceHistory,
    Image,
    SearchEvent,
    ClosetItem,
    CuratedClosetItem,
    OutfitItem,
    Embedding,
    VariantEmbedding,
    ImageEmbedding,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UnionFind:
    """Mathematical Disjoint-Set architecture for resolving sibling groupings."""
    def __init__(self):
        self.parent = {}
    
    def find(self, i: str) -> str:
        if self.parent.setdefault(i, i) == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]
    
    def union(self, i: str, j: str):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            self.parent[root_i] = root_j


def get_or_create(session: Session, model, defaults=None, **kwargs):
    """Helper to get or create a database record."""
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


def import_musinsa_products(products: List[Dict[str, Any]], wipe_existing: bool = False):
    """
    Import a batch of Musinsa products into the DB utilizing Union-Find mapping.
    Expected usage: Send 2 full pages of products (~120 seeds + 600 variants) at once.
    """
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

    # Wipe Mechanism triggered natively for debug setups
    if wipe_existing:
        logger.info("Wiping previous Musinsa products...")
        product_ids_to_delete = [p.id for p in db.query(Product.id).filter(Product.retailer_id == retailer.id).all()]
        if product_ids_to_delete:
            product_variant_ids = [v.id for v in db.query(ProductVariant.id).filter(ProductVariant.product_id.in_(product_ids_to_delete)).all()]
            image_ids = [i.id for i in db.query(Image.id).filter(Image.product_id.in_(product_ids_to_delete)).all()]

            if image_ids:
                db.query(ImageEmbedding).filter(ImageEmbedding.image_id.in_(image_ids)).delete(synchronize_session=False)
            
            if product_variant_ids:
                db.query(VariantEmbedding).filter(VariantEmbedding.variant_id.in_(product_variant_ids)).delete(synchronize_session=False)
                
            db.query(Embedding).filter(Embedding.product_id.in_(product_ids_to_delete)).delete(synchronize_session=False)
            
            db.query(SearchEvent).filter(SearchEvent.product_id.in_(product_ids_to_delete)).delete(synchronize_session=False)
            db.query(ClosetItem).filter(ClosetItem.product_id.in_(product_ids_to_delete)).delete(synchronize_session=False)
            db.query(CuratedClosetItem).filter(CuratedClosetItem.product_id.in_(product_ids_to_delete)).delete(synchronize_session=False)
            db.query(OutfitItem).filter(OutfitItem.product_id.in_(product_ids_to_delete)).delete(synchronize_session=False)
            
            db.query(PriceHistory).filter(PriceHistory.product_id.in_(product_ids_to_delete)).delete(synchronize_session=False)
            db.query(Image).filter(Image.product_id.in_(product_ids_to_delete)).delete(synchronize_session=False)
            db.query(ProductVariant).filter(ProductVariant.product_id.in_(product_ids_to_delete)).delete(synchronize_session=False)
            
            deleted = db.query(Product).filter(Product.id.in_(product_ids_to_delete)).delete(synchronize_session=False)
            db.commit()
            logger.info(f"Deleted {deleted} previous products and associated records.")

    # -------------------------------------------------------------------
    # MATHEMATICAL CLUSTERING (IN-MEMORY)
    # -------------------------------------------------------------------
    uf = UnionFind()
    item_map = {}
    
    # Trace graph connections
    for p in products:
        pid = str(p.get("product_id"))
        item_map[pid] = p
        
        # Connect to variants
        for v in p.get("variant_product_ids", []):
            uf.union(pid, str(v))
            
    # Compile raw clusters
    clusters = defaultdict(list)
    for pid in item_map.keys():
        clusters[uf.find(pid)].append(pid)
        
    logger.info(f"Batched {len(products)} flat items into {len(clusters)} relational trees.")

    # Nominate roots
    cluster_mapping = {} # Root_ID -> List of PIDs
    for c_id, members in clusters.items():
        canonical_root = None
        for pid in members:
            if item_map[pid].get("source_type") == "seed":
                canonical_root = pid
                break
        if not canonical_root:
            canonical_root = sorted(members)[0] # Arbitrary stable fallback
            
        cluster_mapping[canonical_root] = members

    # -------------------------------------------------------------------
    # BULK EXISTENCE CHECK (SINGLE DB HIT)
    # -------------------------------------------------------------------
    all_roots = list(cluster_mapping.keys())
    existing_db_products = db.query(Product).filter(
        Product.retailer_id == retailer.id,
        Product.retailer_product_id.in_(all_roots)
    ).all()
    existing_roots_map = {p.retailer_product_id: p.id for p in existing_db_products}

    # -------------------------------------------------------------------
    # INGESTION ENGINE
    # -------------------------------------------------------------------
    inserted_count = 0
    skipped_count = 0
    
    for canonical_id, members in cluster_mapping.items():
        if canonical_id in existing_roots_map:
            # Optimal Batch skip mechanism!
            skipped_count += 1
            continue

        item = item_map[canonical_id]
        
        # Brand Setup
        raw_brand = item.get("brand_id", "")
        brand_name = raw_brand.strip().lower() if raw_brand else "unknown"
        brand = get_or_create(db, Brand, name=brand_name)
        
        product_name = item.get("product_name", "")

        # 1. Spawn Root Product
        product = Product(
            retailer_id=retailer.id,
            retailer_product_id=canonical_id,
            group_id=canonical_id,
            brand_id=brand.id,
            category_id=None,
            name=product_name,
            description=item.get("description_text", ""),
            url=item.get("product_url"),
            gender="unisex",
            is_available=True,
        )
        db.add(product)
        db.flush() # Yields the new Postgres Auto-Increment ID
        internal_product_id = product.id
        
        # 2. Spawn Price History
        orig_px_raw = item.get("original_price")
        sale_px_raw = item.get("price")
        
        regular_price = float(orig_px_raw) if orig_px_raw else None
        sale_price = float(sale_px_raw) if sale_px_raw else None
        
        discount_rate = None
        if regular_price and sale_price and regular_price > 0:
            discount_rate = round(((regular_price - sale_price) / regular_price) * 100, 2)
        elif regular_price and sale_price and regular_price == sale_price:
            discount_rate = 0.0

        if regular_price is not None or sale_price is not None:
            price_entry = PriceHistory(
                product_id=internal_product_id,
                currency="USD",
                regular_price=regular_price,
                sale_price=sale_price,
                discount_rate=discount_rate,
            )
            db.add(price_entry)
            
        # 3. Spawn Sub-Variants and Images explicitly to the Root
        for variant_sku in members:
            v_item = item_map[variant_sku]
            image_urls = v_item.get("image_urls", [])
            primary_image = image_urls[0] if image_urls else None
            
            variant = ProductVariant(
                product_id=internal_product_id,
                sku=variant_sku,
                stock_status="in_stock",
                image_url=primary_image,
                source_name="musinsa",
                source_variant_id=variant_sku,
                source_payload_version="v1",
            )
            db.add(variant)
            db.flush()
            
            for img_url in image_urls:
                img_entry = Image(
                    product_id=internal_product_id,
                    variant_id=variant.id,
                    url=img_url,
                )
                db.add(img_entry)
        
        inserted_count += 1

    db.commit()
    logger.info(f"Ingestion Finished: {inserted_count} cluster trees written natively. {skipped_count} skipped safely.")


def backfill_musinsa_json(json_path: str):
    logger.info(f"Loading Musinsa JSON: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    if "all_products" in data:
        products = data["all_products"]
    elif isinstance(data, list):
        products = data
    else:
        logger.error("JSON structure not recognized. Expected 'all_products' key or a root array.")
        return

    logger.info(f"Found {len(products)} raw flat dictionaries in JSON.")
    import_musinsa_products(products, wipe_existing=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill Musinsa product data from JSON")
    parser.add_argument("json_path", type=str, help="Path to the JSON scraper output file")
    args = parser.parse_args()

    backfill_musinsa_json(args.json_path)
