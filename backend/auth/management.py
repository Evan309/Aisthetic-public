from __future__ import annotations

import os
import requests
from functools import lru_cache
import time

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE") # This is for your API, but for management we need the management audience usually

# The Management API audience is typically https://{your_domain}/api/v2/
AUTH0_MANAGEMENT_AUDIENCE = f"https://{AUTH0_DOMAIN}/api/v2/"
AUTH0_TOKEN_URL = f"https://{AUTH0_DOMAIN}/oauth/token"

class Auth0ManagementError(Exception):
    pass

@lru_cache(maxsize=1)
def _get_management_token_cached(ttl_hash=None):
    """
    Fetches a new management token.
    ttl_hash is used to force cache invalidation if needed (we'll just use time based in wrapper).
    """
    if not AUTH0_CLIENT_ID or not AUTH0_CLIENT_SECRET:
        print("[WARN] Auth0 Client ID/Secret not set. Cannot use Management API.")
        return None

    payload = {
        "client_id": AUTH0_CLIENT_ID,
        "client_secret": AUTH0_CLIENT_SECRET,
        "audience": AUTH0_MANAGEMENT_AUDIENCE,
        "grant_type": "client_credentials"
    }

    resp = requests.post(AUTH0_TOKEN_URL, json=payload, timeout=10)
    if not resp.ok:
        print(f"[ERROR] Failed to get Auth0 Management Token: {resp.text}")
        return None
    
    data = resp.json()
    return data["access_token"]

# Simple global to track token expiry time roughly
_token_cache = {
    "token": None,
    "expires_at": 0
}

def get_management_token():
    # Verify cached token validity (with buffer)
    now = time.time()
    if _token_cache["token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["token"]
    
    # Fetch new
    if not AUTH0_CLIENT_ID or not AUTH0_CLIENT_SECRET:
        print("[WARN] Auth0 Client ID/Secret not set. Management API disabled.")
        return None

    payload = {
        "client_id": AUTH0_CLIENT_ID,
        "client_secret": AUTH0_CLIENT_SECRET,
        "audience": AUTH0_MANAGEMENT_AUDIENCE,
        "grant_type": "client_credentials"
    }
    
    try:
        resp = requests.post(AUTH0_TOKEN_URL, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        
        _token_cache["token"] = token
        _token_cache["expires_at"] = now + expires_in
        return token
    except Exception as e:
        print(f"[ERROR] Failed to get Auth0 Management Token: {e}")
        return None

def delete_auth0_user(auth0_id: str) -> bool:
    """
    Deletes the user from Auth0. Returns True if success, False otherwise.
    """
    token = get_management_token()
    if not token:
        return False
    
    # Standardize ID if needed? Auth0 ID is usually "provider|id" which works directly in URL
    # URL encoded? "google-oauth2|123" -> URL path should be fine in most libraries, but `requests` path
    # requires explicit handling if it contains special chars? requests handles basics.
    # Actually for Auth0 V2 API: DELETE /api/v2/users/{id}
    # ID must be URL encoded usually.
    
    import urllib.parse
    encoded_id = urllib.parse.quote(auth0_id)
    
    url = f"https://{AUTH0_DOMAIN}/api/v2/users/{encoded_id}"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.delete(url, headers=headers, timeout=10)
        if resp.status_code == 204:
            print(f"[INFO] Successfully deleted user {auth0_id} from Auth0")
            return True
        elif resp.status_code == 404:
            print(f"[INFO] User {auth0_id} not found in Auth0 (already deleted?)")
            return True
        else:
            print(f"[ERROR] Failed to delete Auth0 user {auth0_id}: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        print(f"[ERROR] Exception deleting Auth0 user: {e}")
        return False
