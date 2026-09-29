# api/auth_deps.py
from __future__ import annotations

import os
from functools import lru_cache

import requests
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.dependencies import get_db
from db.models import User  # your SQLAlchemy User model
from db.session import run_with_db_retry

import logging
logger = logging.getLogger(__name__)

http_bearer = HTTPBearer(auto_error=False)

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")
AUTH0_ALGORITHM = os.getenv("AUTH0_ALGORITHMS", "RS256")  # keep your env name
AUTH0_ISSUER = f"https://{AUTH0_DOMAIN}/"

def ensure_auth0_configured() -> None:
    if not AUTH0_DOMAIN or not AUTH0_AUDIENCE:
        raise HTTPException(status_code=503, detail="Authentication is not configured")


# --- JWKS fetch (cached) ---
@lru_cache(maxsize=1)
def get_jwks() -> dict:
    ensure_auth0_configured()
    url = f"{AUTH0_ISSUER}.well-known/jwks.json"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        logger.exception("Failed to fetch Auth0 JWKS")
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc


# --- kid -> key lookup (cached) ---
@lru_cache(maxsize=32)
def get_public_key_for_kid(kid: str) -> dict:
    jwks = get_jwks()
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key:
        return key

    # kid miss: Auth0 may have rotated keys → refetch once
    get_jwks.cache_clear()
    jwks = get_jwks()
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key:
        # JWKS changed → clear kid cache so future lookups stay consistent
        get_public_key_for_kid.cache_clear()
        return key

    raise HTTPException(status_code=401, detail="Invalid Auth0 key ID (kid)")


def validate_jwt(token: str) -> dict:
    ensure_auth0_configured()
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Malformed token") from exc
    kid = header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing kid")

    public_key = get_public_key_for_kid(kid)

    try:
        return jwt.decode(
            token,
            public_key,
            algorithms=[AUTH0_ALGORITHM],
            audience=AUTH0_AUDIENCE,
            issuer=AUTH0_ISSUER,
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user_payload(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    return validate_jwt(credentials.credentials)


# (Keep if you want DB provisioning in the same module)
def get_user_info_from_auth0(token: str) -> dict:
    """Fetch user profile from Auth0 /userinfo endpoint"""
    ensure_auth0_configured()
    url = f"{AUTH0_ISSUER}userinfo"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to fetch userinfo from Auth0: {e}")
        return {}


def get_or_create_user(db: Session, payload: dict, token: str) -> User:
    auth0_id = payload.get("sub")
    if not auth0_id:
        raise HTTPException(status_code=401, detail="Token missing sub")

    email = payload.get("email")
    name = payload.get("name")
    picture = payload.get("picture")
    email_verified = payload.get("email_verified", False)

    if not email:
        logger.debug(f"Email missing in token for {auth0_id}. Fetching /userinfo...")
        user_info = get_user_info_from_auth0(token)
        if user_info:
            email = user_info.get("email")
            name = name or user_info.get("name")
            picture = picture or user_info.get("picture")
            email_verified = user_info.get("email_verified", False)
            logger.debug(f"Fetched userinfo: email={email}")

    def _impl() -> User:
        logger.debug(f"get_or_create_user: auth0_id={auth0_id} email={email} verified={email_verified} (type={type(email_verified)})")
        user = db.query(User).filter(User.auth0_id == auth0_id).first()

        if not user and email and email_verified:
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                logger.info(f"Linking new auth0_id {auth0_id} to existing user {existing_user.id} (email match)")
                user = existing_user

        if user:
            changed = False
            if user.auth0_id != auth0_id:
                user.auth0_id = auth0_id
                changed = True
            if email and user.email != email:
                user.email = email
                changed = True
            if name and user.name != name:
                user.name = name
                changed = True
            if picture and user.profile_picture_url != picture:
                logger.debug(f"syncing PFP from auth0: {picture}")
                user.profile_picture_url = picture
                changed = True
            if changed:
                db.commit()
                db.refresh(user)
            return user

        try:
            user = User(
                auth0_id=auth0_id,
                email=email,
                name=name,
                profile_picture_url=picture,
            )
            db.add(user)
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.auth0_id == auth0_id).first()
            if not user and email:
                user = db.query(User).filter(User.email == email).first()
            if not user:
                raise

        db.refresh(user)
        return user

    return run_with_db_retry(db, _impl, retries=1)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    return get_or_create_user(db, payload, token)
