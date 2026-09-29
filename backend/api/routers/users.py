# api/routers/users.py
from fastapi import APIRouter, Depends, Request, Body, status
from sqlalchemy.orm import Session
from auth.current_user import get_current_user 
from db.models import User, SearchSession, SearchEvent
from db.dependencies import get_db
from api.schemas import UserResponse
from middleware.rate_limit import rate_limit_auth

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserResponse)
@rate_limit_auth()
def get_me(request: Request, user: User = Depends(get_current_user)):
    return user

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
@rate_limit_auth()
def delete_me(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Manually delete Search Events & Sessions (since FK is SET NULL)
    
    # Delete events linked to this user directly
    db.query(SearchEvent).filter(SearchEvent.user_id == user.id).delete(synchronize_session=False)

    # Delete sessions linked to this user
    # Note: SearchEvent rows linked to these sessions will cascade delete if configured,
    # or we should delete them first. 
    db.query(SearchSession).filter(SearchSession.user_id == user.id).delete(synchronize_session=False)
    
    # 2. Delete the user
    # Closets, FavoriteBrands, etc. should cascade if configured in models.py
    # (checked models.py: User.closets -> cascade="all, delete-orphan")
    auth0_id = user.auth0_id
    db.delete(user)
    db.commit()

    # 3. Delete from Auth0
    if auth0_id:
        try:
            from auth.management import delete_auth0_user
            # We run this after commit to ensure local data is gone.
            delete_auth0_user(auth0_id)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to trigger Auth0 deletion: {e}")

    return