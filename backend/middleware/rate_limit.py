"""
Rate limiting configuration and utilities.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address


# Create limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],  # Default for general API
    storage_uri="memory://",
)


# Rate limit decorators for different endpoint types
def rate_limit_auth():
    """Rate limit for authentication endpoints: 20 requests/minute"""
    return limiter.limit("20/minute")


def rate_limit_search():
    """Rate limit for search endpoints: 30 requests/minute"""
    return limiter.limit("30/minute")


def rate_limit_upload():
    """Rate limit for file upload endpoints: 15 requests/minute"""
    return limiter.limit("15/minute")


def rate_limit_closet():
    """Rate limit for closet operations: 60 requests/minute"""
    return limiter.limit("60/minute")
