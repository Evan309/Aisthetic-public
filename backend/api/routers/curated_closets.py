# backend/api/routers/curated_closets.py

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func
from sqlalchemy.sql import over
from sqlalchemy.dialects.postgresql import aggregate_order_by
from pydantic import BaseModel
import numpy as np

from db.dependencies import get_db
from db.models import CuratedCloset, CuratedClosetItem
from api.routers.search import hydrate_product_cards, ann_products_with_scores, l2_normalize_np
from db.utils.backfill_openclip_image_embeddings import OpenCLIPImageEmbedder
from middleware.rate_limit import limiter

from db.models import (
    CuratedCloset,
    CuratedClosetItem,
    ProductVariant,
    Image,
)

router = APIRouter(
    prefix="/curated-closets",
    tags=["curated-closets"],
)
from utils.ml import get_embedder

def get_txt_embedder():
    return get_embedder()


@router.get("")
@limiter.limit("30/minute")
def list_curated_closets(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = (
        db.query(CuratedCloset)
        .filter(CuratedCloset.user_id.is_(None))  # global only for now
        .order_by(CuratedCloset.created_at.desc())
    )

    total = q.count()
    rows = q.offset((page - 1) * limit).limit(limit).all()

    return {
        "closets": [
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "hero_image_url": c.hero_image_url,
                "source": c.source,
                "created_at": c.created_at.isoformat(),
            }
            for c in rows
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


@router.get("/summary")
@limiter.limit("30/minute")
def curated_closets_summary(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = (
        db.query(
            CuratedCloset.id,
            CuratedCloset.title,
            CuratedCloset.description,
            CuratedCloset.hero_image_url,
            CuratedCloset.created_at,
        )
        .filter(CuratedCloset.user_id.is_(None))  # global curated closets
        .order_by(CuratedCloset.created_at.desc())
    )

    total = q.count()
    rows = q.offset((page - 1) * limit).limit(limit).all()
    curated_ids = [r.id for r in rows]
    if not curated_ids:
        return {
            "closets": [],
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit,
        }

    # item counts per curated closet
    item_counts = dict(
        db.query(CuratedClosetItem.curated_closet_id, func.count(CuratedClosetItem.id))
        .filter(CuratedClosetItem.curated_closet_id.in_(curated_ids))
        .group_by(CuratedClosetItem.curated_closet_id)
        .all()
    )

    # deterministic "primary" image per variant
    primary_variant_image = (
        db.query(
            Image.variant_id.label("variant_id"),
            func.min(Image.id).label("image_id"),
        )
        .filter(Image.variant_id.isnot(None))
        .group_by(Image.variant_id)
        .subquery()
    )
    VariantImage = aliased(Image)

    # deterministic "primary" image per product
    primary_product_image = (
        db.query(
            Image.product_id.label("product_id"),
            func.min(Image.id).label("image_id"),
        )
        .group_by(Image.product_id)
        .subquery()
    )
    ProductImage = aliased(Image)

    # build thumb url expression (same as closets summary)
    thumb_url_expr = func.coalesce(
        ProductVariant.image_url,
        VariantImage.url,
        ProductImage.url,
    ).label("thumb_url")

    base = (
        db.query(
            CuratedClosetItem.curated_closet_id.label("curated_closet_id"),
            thumb_url_expr,
            CuratedClosetItem.rank.label("rank"),
        )
        .outerjoin(ProductVariant, ProductVariant.id == CuratedClosetItem.variant_id)
        # join primary variant image
        .outerjoin(primary_variant_image, primary_variant_image.c.variant_id == ProductVariant.id)
        .outerjoin(VariantImage, VariantImage.id == primary_variant_image.c.image_id)
        # join primary product image
        .outerjoin(primary_product_image, primary_product_image.c.product_id == CuratedClosetItem.product_id)
        .outerjoin(ProductImage, ProductImage.id == primary_product_image.c.image_id)
        .filter(CuratedClosetItem.curated_closet_id.in_(curated_ids))
        .filter(thumb_url_expr.isnot(None))
        .subquery()
    )

    ranked = (
        db.query(
            base.c.curated_closet_id,
            base.c.thumb_url,
            over(
                func.row_number(),
                partition_by=base.c.curated_closet_id,
                order_by=base.c.rank.asc(),   # curated uses rank
            ).label("rn"),
        )
        .subquery()
    )

    thumbs_rows = (
        db.query(
            ranked.c.curated_closet_id,
            func.array_agg(
                aggregate_order_by(ranked.c.thumb_url, ranked.c.rn)
            ).label("thumb_urls"),
        )
        .filter(ranked.c.rn <= 3)
        .group_by(ranked.c.curated_closet_id)
        .all()
    )

    thumbs_by = {r.curated_closet_id: (r.thumb_urls or []) for r in thumbs_rows}

    closets = []
    for r in rows:
        closets.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "hero_image_url": r.hero_image_url,
            "item_count": int(item_counts.get(r.id, 0) or 0),
            "thumb_urls": thumbs_by.get(r.id, []),
        })

    return {
        "closets": closets,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }



@router.get("/{curated_closet_id}")
@limiter.limit("60/minute")
def get_curated_closet(
    request: Request,
    curated_closet_id: int,
    db: Session = Depends(get_db),
):
    c = db.get(CuratedCloset, curated_closet_id)
    if not c:
        raise HTTPException(status_code=404, detail="Curated closet not found")

    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "hero_image_url": c.hero_image_url,
        "source": c.source,
        "created_at": c.created_at.isoformat(),
    }


@router.get("/{curated_closet_id}/items")
@limiter.limit("60/minute")
def get_curated_closet_items(
    request: Request,
    curated_closet_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(48, ge=10, le=100),
    db: Session = Depends(get_db),
):
    total = (
        db.query(func.count(CuratedClosetItem.id))
        .filter(CuratedClosetItem.curated_closet_id == curated_closet_id)
        .scalar()
    )

    rows = (
        db.query(CuratedClosetItem.product_id)
        .filter(CuratedClosetItem.curated_closet_id == curated_closet_id)
        .order_by(CuratedClosetItem.rank.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    product_ids = [r[0] for r in rows]
    products = hydrate_product_cards(db, product_ids)

    return {
        "curated_closet_id": curated_closet_id,
        "page": page,
        "page_size": page_size,
        "total_products": total,
        "has_more": page * page_size < total,
        "products": products,
    }


class GenerateCuratedClosetPayload(BaseModel):
    title: str
    description: str | None = None
    hero_image_url: str | None = None
    theme: str
    source: str = "ai"
    k_images: int = 250
    max_products: int = 250


@router.post("/generate")
@limiter.limit("5/minute")
def generate_curated_closet(
    request: Request,
    payload: GenerateCuratedClosetPayload,
    db: Session = Depends(get_db),
    txt_embedder: OpenCLIPImageEmbedder = Depends(get_txt_embedder),
):
    theme = payload.theme.strip()
    if not theme:
        raise HTTPException(status_code=400, detail="theme is required")

    # --- Embed theme ---
    prompt = f"fashion outfit, editorial product photography, {theme}"
    v = txt_embedder.embed_text([prompt])[0].astype(np.float32)
    v = l2_normalize_np(v)

    model_name = txt_embedder.model_tag

    hits = ann_products_with_scores(
        db,
        v.tolist(),
        model_name,
        payload.k_images,
    )

    product_ids = [pid for pid, _ in hits[: payload.max_products]]

    # --- Create curated closet ---
    cc = CuratedCloset(
        title=payload.title,
        description=payload.description,
        hero_image_url=payload.hero_image_url,
        source=payload.source,
        user_id=None,  # global
    )
    db.add(cc)
    db.flush()  # cc.id available

    items = [
        CuratedClosetItem(
            curated_closet_id=cc.id,
            product_id=pid,
            variant_id=None,
            rank=i + 1,
        )
        for i, pid in enumerate(product_ids)
    ]

    db.add_all(items)
    db.commit()
    db.refresh(cc)

    # Return first page immediately
    page_size = 48
    products = hydrate_product_cards(db, product_ids[:page_size])

    thumbs = []
    for p in products[:3]:
        if getattr(p, "image", None):
            thumbs.append(p.image)


    return {
        "id": cc.id,
        "title": cc.title,
        "description": cc.description,
        "hero_image_url": cc.hero_image_url,
        "source": cc.source,
        "thumb_urls": thumbs,
        "page": 1,
        "page_size": page_size,
        "total_products": len(product_ids),
        "has_more": len(product_ids) > page_size,
        "products": products,
    }
