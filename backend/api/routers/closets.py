from fastapi import APIRouter, Depends, HTTPException, Request, Query
from typing import List, Optional
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, aliased
from api.schemas import (
    ClosetCreate, ClosetUpdate, ClosetResponse, ClosetItemResponse,
    OutfitCreate, OutfitResponse, OutfitItemResponse, OutfitItemAdd,
    ClosetItemProductCardResponse, ClosetSummaryResponse, ClosetCollaboratorResponse
)
from db.models import Closet, ClosetItem, Outfit, OutfitItem, User, ProductVariant, Image, Product, PriceHistory, Brand, ClosetCollaborator
from api.dependencies  import get_db
from api.utils.slugify import slugify
from auth.current_user import get_current_user
from auth.dependencies import http_bearer, validate_jwt, get_or_create_user
from sqlalchemy import func, desc, or_, and_, text
from datetime import datetime
from sqlalchemy.sql import over
from sqlalchemy.dialects.postgresql import aggregate_order_by
from middleware.rate_limit import rate_limit_closet
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/closets", tags=["closets"])


# -------------------------------------------------------
# Helpers
# -------------------------------------------------------

def get_closet_role(db: Session, closet: Closet, user_id: int) -> str | None:
    """Returns 'owner', 'editor', 'viewer', or None."""
    if closet.user_id == user_id:
        return "owner"
    
    collab = db.query(ClosetCollaborator).filter_by(closet_id=closet.id, user_id=user_id).first()
    if collab:
        return collab.role
    return None

def check_access(db: Session, closet_id: int, user_id: int, min_role: str = "viewer") -> tuple[Closet, str]:
    """
    Verifies user has access to closet.
    min_role: 'viewer' | 'editor' | 'owner'
    Returns (closet, role)
    """
    closet = db.query(Closet).filter(Closet.id == closet_id).first()
    if not closet:
        raise HTTPException(404, "Closet not found")

    role = get_closet_role(db, closet, user_id)
    
    logger.debug(f"check_access: closet={closet_id}, user={user_id}, role={role}")
    
    if not role:
        raise HTTPException(404, "Closet not found") # Hide existence if no access
    
    # Check hierarchy
    # owner > editor > viewer
    allowed = False
    if min_role == "viewer":
        allowed = True
    elif min_role == "editor":
        allowed = role in ("owner", "editor")
    elif min_role == "owner":
        allowed = role == "owner"
    
    if not allowed:
        raise HTTPException(403, "Insufficient permissions")
        
    return closet, role


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials is None:
        return None
    payload = validate_jwt(credentials.credentials)
    return get_or_create_user(db, payload, credentials.credentials)


# -------------------------------------------------------
# Create Closet
# -------------------------------------------------------
@router.post("", response_model=ClosetResponse)
@rate_limit_closet()
def create_closet(
    request: Request,
    payload: ClosetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    slug = slugify(payload.name)

    closet = Closet(
        user_id=user.id,
        name=payload.name,
        description=payload.description,
        slug=slug,
        # Tokens generated on demand, or we could generate them on create
        view_token=str(uuid.uuid4()), 
        edit_token=str(uuid.uuid4())
    )

    db.add(closet)
    db.commit()
    db.refresh(closet)
    
    # Hydrate response fields
    closet.role = "owner"
    closet.collaborators = []
    
    return closet


# -------------------------------------------------------
# List My Closets (Owned + Shared)
# -------------------------------------------------------
@router.get("/me/summary", response_model=List[ClosetSummaryResponse])
@rate_limit_closet()
def get_my_closets_summary(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "recently_updated",
    sort_order: str | None = None,
):
    sort_by = (sort_by or "recently_updated").strip().lower()
    sort_order = (sort_order or "").strip().lower() or None
    
    # 1. Fetch relevant closet IDs (Owned OR Collaborated)
    owned_ids = db.query(Closet.id).filter(Closet.user_id == user.id)
    shared_ids = db.query(ClosetCollaborator.closet_id).filter(ClosetCollaborator.user_id == user.id)
    
    combined_q = owned_ids.union(shared_ids).subquery()
    
    # 2. Query closets
    q = db.query(Closet).filter(Closet.id.in_(combined_q))

    # Helper for sorting
    def _dir(expr, default_desc: bool):
        if sort_order == "asc": return expr.asc()
        if sort_order == "desc": return expr.desc()
        return expr.desc() if default_desc else expr.asc()

    if sort_by in ("recently_updated", "updated"):
        q = q.order_by(_dir(Closet.updated_at, True), Closet.id.desc())
    elif sort_by in ("created_at", "created"):
        q = q.order_by(_dir(Closet.created_at, True), Closet.id.desc())
    elif sort_by in ("name", "a_to_z"):
        q = q.order_by(_dir(func.lower(Closet.name), False), Closet.id.desc())
    # Note: item_count sort is removed for simplicity/perf in this complex join, 
    # but we could add it back if critical.
    else:
        q = q.order_by(_dir(Closet.updated_at, True), Closet.id.desc())

    closets = q.limit(limit).offset(offset).all()
    
    if not closets:
        return []
    
    closet_ids = [c.id for c in closets]

    # 3. Fetch Metadata (Item counts, roles)
    item_counts = dict(
        db.query(ClosetItem.closet_id, func.count(ClosetItem.id))
        .filter(ClosetItem.closet_id.in_(closet_ids))
        .group_by(ClosetItem.closet_id).all()
    )
    
    outfit_counts = dict(
        db.query(Outfit.closet_id, func.count(Outfit.id))
        .filter(Outfit.closet_id.in_(closet_ids))
        .group_by(Outfit.closet_id).all()
    )
    
    collab_roles = dict(
        db.query(ClosetCollaborator.closet_id, ClosetCollaborator.role)
        .filter(ClosetCollaborator.closet_id.in_(closet_ids), ClosetCollaborator.user_id == user.id)
        .all()
    )

    # 4. Fetch Thumbnails (Same optimistic logic as before)
    # ... (Thumbnail logic omitted for brevity, reusing previous complex query would be ideal but massive)
    # For now, let's just fetch simplified thumbnails to keep this file clean, 
    # or copy-paste the big block if we want to preserve exact behavior.
    # Let's preserve the behavior but simplified slightly.
    
    # -- Thumbnails --
    primary_var = db.query(Image.variant_id, func.min(Image.id).label("iid")).filter(Image.variant_id.isnot(None)).group_by(Image.variant_id).subquery()
    primary_prod = db.query(Image.product_id, func.min(Image.id).label("iid")).group_by(Image.product_id).subquery()
    
    VI = aliased(Image)
    PI = aliased(Image)
    
    thumb_expr = func.coalesce(ProductVariant.image_url, VI.url, PI.url)
    
    thumbs_q = (
        db.query(ClosetItem.closet_id, thumb_expr)
        .outerjoin(ProductVariant, ProductVariant.id == ClosetItem.variant_id)
        .outerjoin(primary_var, primary_var.c.variant_id == ProductVariant.id)
        .outerjoin(VI, VI.id == primary_var.c.iid)
        .outerjoin(primary_prod, primary_prod.c.product_id == ClosetItem.product_id)
        .outerjoin(PI, PI.id == primary_prod.c.iid)
        .filter(ClosetItem.closet_id.in_(closet_ids))
        .filter(thumb_expr.isnot(None))
        .order_by(ClosetItem.closet_id, ClosetItem.added_at.desc())
    )
    
    # Naive fetch all and group in python to avoid window functions complexity here
    # (assuming 50 closets * 3 thumbs isn't too huge)
    all_thumbs = thumbs_q.all()
    thumbs_map = {}
    for cid, url in all_thumbs:
        if cid not in thumbs_map: thumbs_map[cid] = []
        if len(thumbs_map[cid]) < 3:
            thumbs_map[cid].append(url)

    # 5. Fetch Owners & Collaborators
    # Owners
    owner_ids = list(set([c.user_id for c in closets]))
    owners = db.query(User).filter(User.id.in_(owner_ids)).all()
    owner_map = {u.id: u for u in owners}

    # Collaborators per closet
    # We want to show avatars of people who have access
    closet_collabs = db.query(ClosetCollaborator).filter(ClosetCollaborator.closet_id.in_(closet_ids)).all()
    
    # We need user details for these collaborators
    collab_user_ids = list(set([cc.user_id for cc in closet_collabs]))
    collab_users = db.query(User).filter(User.id.in_(collab_user_ids)).all()
    collab_user_map = {u.id: u for u in collab_users}
    
    # Map closet_id -> list of collaborators with user details
    closet_collab_map = {}
    for cc in closet_collabs:
        if cc.closet_id not in closet_collab_map:
            closet_collab_map[cc.closet_id] = []
        
        u = collab_user_map.get(cc.user_id)
        if u:
            closet_collab_map[cc.closet_id].append({
                "user_id": u.id,
                "role": cc.role,
                "username": u.name,
                "email": None, # Don't expose emails in summary
                "profile_picture_url": u.profile_picture_url,
            })

    res = []
    for c in closets:
        role = "owner" if c.user_id == user.id else collab_roles.get(c.id, "viewer")
        
        # Hydrate owner
        owner_u = owner_map.get(c.user_id)
        owner_data = {
            "id": owner_u.id,
            "auth0_id": owner_u.auth0_id,
            "name": owner_u.name,
            "email": None, # Hide email
            "profile_picture_url": owner_u.profile_picture_url
        } if owner_u else None

        res.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "slug": c.slug,
            "role": role,
            "item_count": item_counts.get(c.id, 0),
            "outfit_count": outfit_counts.get(c.id, 0),
            "thumb_urls": thumbs_map.get(c.id, []),
            "owner": owner_data,
            "collaborators": closet_collab_map.get(c.id, [])
        })
        
    return res


# -------------------------------------------------------
# Get Closet Details (Authenticated)
# -------------------------------------------------------
@router.get("/{closet_id}", response_model=ClosetResponse)
@rate_limit_closet()
def get_closet(
    request: Request,
    closet_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    closet, role = check_access(db, closet_id, user.id, "viewer")
    
    # Create a response dict to avoid modifying the ORM object state which triggers the relationship error
    response_data = {
        "id": closet.id,
        "name": closet.name,
        "description": closet.description,
        "slug": closet.slug,
        "role": role,
        "created_at": closet.created_at,
        "updated_at": closet.updated_at,
        "user_id": closet.user_id,
        "view_token": None,
        "edit_token": None,
        "collaborators": [],
        "owner": None
    }

    # Populate Owner
    owner_u = db.query(User).filter(User.id == closet.user_id).first()
    if owner_u:
        response_data["owner"] = {
            "id": owner_u.id,
            "auth0_id": owner_u.auth0_id,
            "name": owner_u.name,
            "email": owner_u.email if role == "owner" else None, # Hide email unless owner
            "profile_picture_url": owner_u.profile_picture_url
        }

    # Populate Collaborators (Visible to EVERYONE now)
    collabs = db.query(ClosetCollaborator).filter_by(closet_id=closet.id).all()
    if collabs:
        uids = [c.user_id for c in collabs]
        users = db.query(User).filter(User.id.in_(uids)).all()
        u_map = {u.id: u for u in users}
        
        collaborator_list = []
        for c in collabs:
            u = u_map.get(c.user_id)
            collaborator_list.append({
                "user_id": c.user_id,
                "role": c.role,
                "username": u.name if u else "Unknown",
                "email": u.email if (u and role == "owner") else None, # Only owner sees emails
                "profile_picture_url": u.profile_picture_url if u else None,
            })
        response_data["collaborators"] = collaborator_list

    # Only owner sees tokens
    if role == "owner":
        response_data["view_token"] = closet.view_token
        response_data["edit_token"] = closet.edit_token
        
    return response_data


# -------------------------------------------------------
# Join / Token Access
# -------------------------------------------------------
@router.get("/join/{token}", response_model=ClosetResponse)
@rate_limit_closet()
def join_closet_by_token(
    request: Request,
    token: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user), # User must be logged in to JOIN
):
    """
    If token matches edit_token -> Add user as editor.
    If token matches view_token -> Return closet as viewer (ephemeral or persistent?).
    
    For now:
    - Edit Token: Join as editor. Return closet.
    - View Token: Return closet (read-only mode). Do NOT add to DB?
      - Design choice: "Shared with me" implies DB persistence.
      - Let's say: View token also adds you as 'viewer' so it shows in 'Shared with me'.
    """
    
    # 1. Check Edit Token
    closet = db.query(Closet).filter(Closet.edit_token == token).first()
    target_role = "editor"
    
    if not closet:
        # 2. Check View Token
        closet = db.query(Closet).filter(Closet.view_token == token).first()
        target_role = "viewer"
    
    if not closet:
        raise HTTPException(404, "Invalid token")

    if closet.user_id == user.id:
        effective_role = "owner"
    else:
        # Check if user is already a collaborator
        current = db.query(ClosetCollaborator).filter_by(closet_id=closet.id, user_id=user.id).first()
        logger.debug(f"join: closet={closet.id}, user={user.id}, current_collab={current}")
    
        if current:
            # Upgrade if new role is higher? Ex: Viewer clicks Edit link
            if current.role == "viewer" and target_role == "editor":
                logger.debug("join: Upgrading to editor")
                current.role = "editor"
                db.commit()
                effective_role = "editor"
            else:
                effective_role = current.role
        else:
            # Create new collab
            logger.debug(f"join: Creating new collaborator role={target_role}")
            new_collab = ClosetCollaborator(
                closet_id=closet.id,
                user_id=user.id,
                role=target_role
            )
            db.add(new_collab)
            db.commit()
            logger.debug("join: Committed")
            effective_role = target_role
    
    # Create response dict
    response_data = {
        "id": closet.id,
        "name": closet.name,
        "description": closet.description,
        "slug": closet.slug,
        "role": effective_role, # This is the role we just calculated/assigned above
        "created_at": closet.created_at,
        "updated_at": closet.updated_at,
        "user_id": closet.user_id,
        "view_token": None,
        "edit_token": None,
        "collaborators": [],
        "owner": None
    }
    
    # Populate Owner
    owner_u = db.query(User).filter(User.id == closet.user_id).first()
    if owner_u:
        response_data["owner"] = {
            "id": owner_u.id,
            "auth0_id": owner_u.auth0_id,
            "name": owner_u.name,
            "email": None,
            "profile_picture_url": owner_u.profile_picture_url
        }

    return response_data


# -------------------------------------------------------
# Collaborator Management (Owner Only)
# -------------------------------------------------------
@router.post("/{closet_id}/tokens/regenerate", response_model=ClosetResponse)
def regenerate_tokens(
    closet_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    closet, role = check_access(db, closet_id, user.id, "owner")
    
    closet.view_token = str(uuid.uuid4())
    closet.edit_token = str(uuid.uuid4())
    db.commit()
    db.refresh(closet)
    
    closet.role = "owner"
    return closet


@router.delete("/{closet_id}/collaborators/{target_user_id}")
def remove_collaborator(
    closet_id: int,
    target_user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    closet, role = check_access(db, closet_id, user.id, "owner")
    
    collab = db.query(ClosetCollaborator).filter_by(closet_id=closet_id, user_id=target_user_id).first()
    if collab:
        db.delete(collab)
        db.commit()
    
    return {"success": True}


@router.patch("/{closet_id}/collaborators/{target_user_id}")
def update_collaborator_role(
    closet_id: int,
    target_user_id: int,
    role: str = Query(..., pattern="^(viewer|editor)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    closet, _ = check_access(db, closet_id, user.id, "owner")
    
    collab = db.query(ClosetCollaborator).filter_by(closet_id=closet_id, user_id=target_user_id).first()
    if not collab:
        raise HTTPException(404, "Collaborator not found")
        
    collab.role = role
    db.commit()
    return {"success": True}


# -------------------------------------------------------
# Update closet settings
# -------------------------------------------------------
@router.patch("/{closet_id}", response_model=ClosetResponse)
@rate_limit_closet()
def update_closet(
    request: Request,
    closet_id: int,
    payload: ClosetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Editors can't rename? Assuming owner only for settings now as per user plan "collaborater can do anything other than access settings"
    closet, role = check_access(db, closet_id, user.id, "owner")

    data = payload.model_dump(exclude_unset=True)

    if "name" in data:
        closet.name = data["name"]
        closet.slug = slugify(data["name"])

    if "description" in data:
        closet.description = data["description"]
        
    # is_public is removed, so ignore it if passed (backwards compat)

    db.commit()
    db.refresh(closet)
    closet.role = role
    return closet


# -------------------------------------------------------
# Add item
# -------------------------------------------------------
@router.post("/{closet_id}/items", response_model=ClosetItemResponse)
@rate_limit_closet()
def add_item(
    request: Request,
    closet_id: int,
    product_id: int,
    variant_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Editors can add items
    closet, role = check_access(db, closet_id, user.id, "editor")

    item = ClosetItem(
        closet_id=closet.id,
        product_id=product_id,
        variant_id=variant_id
    )

    db.add(item)
    closet.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.get("/{closet_id}/items/cards", response_model=List[ClosetItemProductCardResponse])
@rate_limit_closet()
def get_closet_item_cards(
    request: Request,
    closet_id: int,
    limit: int = 48,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
    token: Optional[str] = None
):
    # If token provided, validate token -> allow viewer access
    # If no token, user must be logged in -> check_access
    
    if token:
        # Token Access
        closet = db.query(Closet).filter(or_(Closet.view_token == token, Closet.edit_token == token)).first()
        if not closet or closet.id != closet_id:
            raise HTTPException(403, "Invalid token")
        # Allowed as viewer/editor
    else:
        # User Access
        if user is None:
            raise HTTPException(401, "Missing Authorization header")
        check_access(db, closet_id, user.id, "viewer") # Viewers can see items

    # ... (Rest of logic is same as before, re-pasting the complex query)
    
    limit = min(max(limit, 1), 96)

    # Primary images (DISTINCT ON)
    primary_variant_img = (
        db.query(Image.variant_id.label("variant_id"), Image.url.label("url"))
        .filter(Image.variant_id.isnot(None))
        .distinct(Image.variant_id).order_by(Image.variant_id, Image.id.asc()).subquery()
    )
    primary_product_img = (
        db.query(Image.product_id.label("product_id"), Image.url.label("url"))
        .distinct(Image.product_id).order_by(Image.product_id, Image.id.asc()).subquery()
    )

    thumb_url = func.coalesce(
        ProductVariant.image_url,
        primary_variant_img.c.url,
        primary_product_img.c.url,
    ).label("thumb_url")

    latest_price = (
        db.query(
            PriceHistory.product_id.label("product_id"),
            PriceHistory.regular_price.label("regular_price"),
            PriceHistory.sale_price.label("sale_price"),
        ).distinct(PriceHistory.product_id).order_by(PriceHistory.product_id, PriceHistory.scraped_at.desc()).subquery()
    )

    rows = (
        db.query(
            ClosetItem.id.label("item_id"),
            ClosetItem.added_at.label("added_at"),
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.is_available.label("is_available"),
            Brand.name.label("brand_name"),
            thumb_url,
            latest_price.c.regular_price,
            latest_price.c.sale_price,
        )
        .join(Product, Product.id == ClosetItem.product_id)
        .outerjoin(Brand, Brand.id == Product.brand_id)
        .outerjoin(ProductVariant, ProductVariant.id == ClosetItem.variant_id)
        .outerjoin(primary_variant_img, primary_variant_img.c.variant_id == ProductVariant.id)
        .outerjoin(primary_product_img, primary_product_img.c.product_id == Product.id)
        .outerjoin(latest_price, latest_price.c.product_id == Product.id)
        .filter(ClosetItem.closet_id == closet_id)
        .order_by(ClosetItem.added_at.desc(), ClosetItem.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    out = []
    for r in rows:
        price = float(r.sale_price) if r.sale_price else (float(r.regular_price) if r.regular_price else None)
        original = float(r.regular_price) if (r.sale_price and r.regular_price) else None
        out.append({
            "item_id": r.item_id,
            "added_at": r.added_at,
            "product": {
                "id": r.product_id,
                "name": r.product_name,
                "brand": r.brand_name,
                "image": r.thumb_url,
                "price": price,
                "originalPrice": original,
                "inStock": bool(r.is_available),
                "description": None, "category": None, "rating": None, "reviewCount": None
            },
        })
    return out


# -------------------------------------------------------
# Remove item & closet
# -------------------------------------------------------
@router.delete("/{closet_id}")
@rate_limit_closet()
def delete_closet(
    request: Request,
    closet_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Only owner can delete
    closet, role = check_access(db, closet_id, user.id, "owner")
    db.delete(closet)
    db.commit()
    return {"success": True}


@router.delete("/{closet_id}/items/{item_id}")
@rate_limit_closet()
def remove_item(
    request: Request,
    closet_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Editors can remove items
    closet, role = check_access(db, closet_id, user.id, "editor")

    item = db.query(ClosetItem).filter_by(id=item_id, closet_id=closet.id).first()
    if not item:
        raise HTTPException(404, "Item not found")

    db.delete(item)
    closet.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "item_id": item_id}


# -------------------------------------------------------
# Create outfit inside closet
# -------------------------------------------------------
@router.post("/{closet_id}/outfits", response_model=OutfitResponse)
@rate_limit_closet()
def create_outfit(
    request: Request,
    closet_id: int,
    payload: OutfitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Editors can create outfits? Let's say yes for now.
    closet, role = check_access(db, closet_id, user.id, "editor")

    outfit = Outfit(
        closet_id=closet.id,
        name=payload.name,
        description=payload.description,
    )

    db.add(outfit)
    db.commit()
    db.refresh(outfit)
    return outfit


@router.post("/outfits/{outfit_id}/items", response_model=OutfitItemResponse)
@rate_limit_closet()
def add_outfit_item(
    request: Request,
    outfit_id: int,
    payload: OutfitItemAdd,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    outfit = db.query(Outfit).filter(Outfit.id == outfit_id).first()
    if not outfit:
        raise HTTPException(404, "Outfit not found")

    # Check closet access
    closet, role = check_access(db, outfit.closet_id, user.id, "editor")

    item = OutfitItem(
        outfit_id=outfit.id,
        product_id=payload.product_id,
        variant_id=payload.variant_id,
        position_x=payload.position_x,
        position_y=payload.position_y,
    )

    db.add(item)
    db.commit()
    db.refresh(item)
    return item
