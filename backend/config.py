"""
Configuration management for the AI Fashion Shopper API.
Centralizes environment variables and provides type-safe configuration.
"""
import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

# Base directory
BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "")
    
    # Frontend
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    api_url: str = os.getenv("API_URL", "http://localhost:8000")
    
    # Auth0
    auth0_domain: str = os.getenv("AUTH0_DOMAIN", "")
    auth0_audience: str = os.getenv("AUTH0_AUDIENCE", "")
    auth0_algorithms: str = os.getenv("AUTH0_ALGORITHMS", "RS256")
    
    # File paths (relative to BASE_DIR)
    global_category_map: Path = BASE_DIR / "utils" / "maps" / "global_category_rules.json"
    musinsa_save_path: Path = BASE_DIR / "data" / "product_catalog" / "musinsa_products"
    
    # Rate limiting
    rate_limit_enabled: bool = True
    
    # Security
    enable_https_redirect: bool = environment == "production"
    enable_api_docs: bool = environment != "production"
    
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        return self.environment == "development"
    
    class Config:
        case_sensitive = False


# Global settings instance
settings = Settings()
