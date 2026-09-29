import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import psutil
from dotenv import load_dotenv
from sqlalchemy.exc import DBAPIError, OperationalError

from api import all_routers
from config import settings
from db.session import is_transient_db_error
from middleware.security import SecurityHeadersMiddleware, RequestIDMiddleware, HTTPSRedirectMiddleware
from middleware.rate_limit import limiter

load_dotenv()
logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager
from utils.ml import get_embedder

def log_memory(stage: str):
    """Log current memory usage"""
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    mem_mb = mem_info.rss / 1024 / 1024
    print(f"🧠 MEMORY [{stage}]: {mem_mb:.2f} MB ({mem_mb/1024:.2f} GB)")
    return mem_mb

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Log memory before loading model
    log_memory("Server Startup")
    
    # Eager load the ML model on startup
    print("INFO:    Eager loading ML model...")
    log_memory("Before Model Load")
    
    get_embedder()
    
    log_memory("After Model Load")
    print("INFO:    ML model loaded successfully.")
    
    yield
    
    # Cleanup
    log_memory("Server Shutdown")

# Create FastAPI app with conditional docs
app = FastAPI(
    title="AI Fashion Shopper API",
    description="Backend API for AI Fashion Shopper application",
    version="1.0.0",
    docs_url="/docs" if settings.enable_api_docs else None,
    redoc_url="/redoc" if settings.enable_api_docs else None,
    lifespan=lifespan,
)


# ============================================================
# Security Middleware (order matters!)
# ============================================================

# 1. HTTPS redirect (production only)
if settings.enable_https_redirect:
    app.add_middleware(HTTPSRedirectMiddleware)

# 2. Trusted host middleware
allowed_hosts = ["*"] if settings.is_development else [
    "api.aisthetic.shop",
    "aisthetic.shop",
    "www.aisthetic.shop",
    "*.onrender.com",  # Allow Render subdomains
    "*.railway.app",  # Allow Railway subdomains
    "localhost",
    "127.0.0.1"
]
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

# 3. Security headers
app.add_middleware(SecurityHeadersMiddleware)

# 4. Request ID tracking
app.add_middleware(RequestIDMiddleware)

# 5. CORS (after security headers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "https://aisthetic.shop",
        "https://www.aisthetic.shop",
        "https://aisthetic-frontend.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Request-ID"],
    max_age=3600,
)

# ============================================================
# Rate Limiting
# ============================================================

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def _db_unavailable_response() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": "Database temporarily unavailable. Please retry shortly."},
    )


@app.exception_handler(OperationalError)
async def operational_error_handler(request: Request, exc: OperationalError):
    if is_transient_db_error(exc):
        logger.warning("Transient DB OperationalError during request", exc_info=True)
        return _db_unavailable_response()
    logger.exception("Non-transient OperationalError during request")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.exception_handler(DBAPIError)
async def dbapi_error_handler(request: Request, exc: DBAPIError):
    if is_transient_db_error(exc):
        logger.warning("Transient DBAPIError during request", exc_info=True)
        return _db_unavailable_response()
    logger.exception("Non-transient DBAPIError during request")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

# ============================================================
# Routes
# ============================================================

# Include routers with API versioning
for router in all_routers:
    app.include_router(router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "message": "AI Fashion Shopper API",
        "version": "1.0.0",
        "api_version": "v1",
        "docs": "/docs" if settings.enable_api_docs else "disabled",
        "health": "/api/v1/health"
    }


@app.get("/health")
def health_check_root():
    """Root health check (no versioning for monitoring)"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development
    )
