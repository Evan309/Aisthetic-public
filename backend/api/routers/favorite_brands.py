from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from api.dependencies import get_db
from auth.dependencies import get_current_user  # ✅ matches your dependencies.py
from db.models import FavoriteBrand, Brand, User
from middleware.rate_limit import limiter

router = APIRouter(prefix="/users/me/favorite-brands", tags=["favorites"])

@router.get("")
@limiter.limit("60/minute")
def get_my_favorite_brand_ids(
    request: Request,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    rows = (
        db.query(FavoriteBrand.brand_id)
        .filter(FavoriteBrand.user_id == me.id)
        .all()
    )
    return {"brand_ids": [r[0] for r in rows]}

@router.put("/{brand_id}")
@limiter.limit("60/minute")
def favorite_brand(
    request: Request,
    brand_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    # ensure brand exists
    if not db.query(Brand.id).filter(Brand.id == brand_id).first():
        raise HTTPException(status_code=404, detail="Brand not found")

    # idempotent: already favorited -> ok
    exists = (
        db.query(FavoriteBrand)
        .filter(FavoriteBrand.user_id == me.id, FavoriteBrand.brand_id == brand_id)
        .first()
    )
    if exists:
        return {"ok": True}

    db.add(FavoriteBrand(user_id=me.id, brand_id=brand_id))
    db.commit()
    return {"ok": True}

@router.delete("/{brand_id}")
@limiter.limit("60/minute")
def unfavorite_brand(
    request: Request,
    brand_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
):
    row = (
        db.query(FavoriteBrand)
        .filter(FavoriteBrand.user_id == me.id, FavoriteBrand.brand_id == brand_id)
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True}
