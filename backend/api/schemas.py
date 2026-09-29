from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime



# User Schemas
class UserResponse(BaseModel):
    id: int
    auth0_id: str
    email: Optional[str]
    name: Optional[str]
    profile_picture_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class ProductVariant(BaseModel):
    id: int
    sku: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    material: Optional[str] = None
    image_url: Optional[str] = None
    stock_status: Optional[str] = None

    class Config:
        from_attributes = True


class Category(BaseModel):
    id: int
    main: str
    sub: str

    class Config:
        from_attributes = True


class Brand(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class Retailer(BaseModel):
    id: int
    name: str
    slug: str
    site_url: Optional[str] = None
    currency: Optional[str] = None

    class Config:
        from_attributes = True


class PriceInfo(BaseModel):
    regular_price: float
    sale_price: Optional[float] = None
    discount_rate: Optional[float] = None
    currency: str


class ProductImage(BaseModel):
    id: int
    url: str
    width: Optional[int] = None
    height: Optional[int] = None
    variant_id: Optional[int] = None

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    url: Optional[str] = None
    gender: Optional[str] = None
    is_available: bool = True


class Product(ProductBase):
    brand: Optional[Brand] = None
    category: Optional[Category] = None
    retailer: Optional[Retailer] = None
    images: List[ProductImage] = []
    variants: List[ProductVariant] = []
    price_info: Optional[PriceInfo] = None
    
    # Frontend-compatible fields
    price: Optional[float] = None
    originalPrice: Optional[float] = None
    image: Optional[str] = None
    images_list: Optional[List[str]] = None
    category_name: Optional[str] = None
    brand_name: Optional[str] = None
    inStock: bool = True
    rating: Optional[float] = None
    reviewCount: Optional[int] = None

    class Config:
        from_attributes = True


class ProductListItem(BaseModel):
    id: int
    name: str
    price: Optional[float] = None
    originalPrice: Optional[float] = None
    image: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    inStock: bool = True
    rating: Optional[float] = None
    reviewCount: Optional[int] = None

    class Config:
        from_attributes = True


# Category Schema for frontend
class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    parentId: Optional[str] = None


# Query Parameters
class ProductQueryParams(BaseModel):
    search: Optional[str] = None
    category: Optional[str] = None
    main_category: Optional[str] = None
    sub_category: Optional[str] = None
    gender: Optional[str] = None
    brand: Optional[str] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)


# Response Models
class ProductListResponse(BaseModel):
    products: List[ProductListItem]
    total: int
    page: int
    limit: int
    total_pages: int


class HealthCheck(BaseModel):
    status: str
    database: str
    timestamp: datetime


class BrandWithImage(BaseModel):
    id: int
    name: str
    productCount: Optional[int]
    image: Optional[str]


class BrandListResponse(BaseModel):
    brands: List[BrandWithImage]
    total: int
    page: int
    limit: int
    total_pages: int


class ClosetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Name cannot be empty or whitespace')
        return v.strip()


class ClosetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError('Name cannot be empty or whitespace')
        return v.strip() if v else None


class ClosetItemResponse(BaseModel):
    id: int
    product_id: int
    variant_id: Optional[int]

    class Config:
        from_attributes = True


class ClosetItemProductCardResponse(BaseModel):
    item_id: int
    added_at: datetime
    product: ProductListItem

    class Config:
        from_attributes = True


class ClosetCollaboratorResponse(BaseModel):
    user_id: int
    role: str
    username: Optional[str] = None # Hydrated from User.name
    email: Optional[str] = None    # Hydrated from User.email (Owner only)
    profile_picture_url: Optional[str] = None  # Hydrated from User.profile_picture_url

    class Config:
        from_attributes = True


    class Config:
        from_attributes = True


class ClosetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    slug: Optional[str]
    
    # Owner-only fields (or via token)
    view_token: Optional[str] = None
    edit_token: Optional[str] = None
    
    role: Optional[str] = None # 'owner', 'editor', 'viewer'

    items: List[ClosetItemResponse] = []
    
    # ✅ Collaboration updates
    owner: Optional[UserResponse] = None
    collaborators: List[ClosetCollaboratorResponse] = []

    class Config:
        from_attributes = True


class ClosetSummaryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    slug: Optional[str] = None
    
    item_count: int
    outfit_count: int
    thumb_urls: List[str] = []
    
    role: str = "owner" # 'owner', 'editor', 'viewer'
    
    # ✅ Collaboration updates
    owner: Optional[UserResponse] = None
    collaborators: List[ClosetCollaboratorResponse] = []

    class Config:
        from_attributes = True



class OutfitCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class OutfitItemAdd(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class OutfitItemResponse(BaseModel):
    id: int
    product_id: int
    variant_id: Optional[int]
    position_x: Optional[float]
    position_y: Optional[float]

    class Config:
        from_attributes = True


class OutfitResponse(BaseModel):
    id: int
    name: Optional[str]
    description: Optional[str]
    items: List[OutfitItemResponse]

    class Config:
        from_attributes = True
