from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db.dependencies import get_db
from db.models import User
from auth.dependencies import get_current_user_payload, get_or_create_user, http_bearer


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    return get_or_create_user(db, payload, token)

