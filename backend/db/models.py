from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    ForeignKey, Float, UniqueConstraint, Index
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func, text
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB

Base = declarative_base()

# -- Core Lookup Tables --

class Retailer(Base):
    __tablename__ = "retailer"

    id = Column(Integer, primary_key=True)
    slug = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    site_url = Column(Text, nullable=True)
    currency = Column(String(8), nullable=True)


class Brand(Base):
    __tablename__ = "brand"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), unique=True, nullable=False, index=True)


class Category(Base):
    __tablename__ = "category"

    id = Column(Integer, primary_key=True)
    main = Column(String(64), nullable=False, index=True)
    sub = Column(String(64), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("main", "sub", name="uq_category_main_sub"),
    )


# -- Products & Related --

class Product(Base):
    __tablename__ = "product"

    id = Column(Integer, primary_key=True)

    retailer_id = Column(Integer, ForeignKey("retailer.id", ondelete="SET NULL"), nullable=True, index=True)
    retailer_product_id = Column(String(128), nullable=True, index=True)
    group_id = Column(String(128), nullable=True, index=True)

    brand_id = Column(Integer, ForeignKey("brand.id", ondelete="SET NULL"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("category.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    gender = Column(String(16), nullable=True, index=True)  # "men", "women", "unisex", etc.
    is_available = Column(Boolean, nullable=False, server_default=text("true"))

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now(), nullable=True)

    retailer = relationship("Retailer")
    brand = relationship("Brand")
    category = relationship("Category")

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    prices = relationship("PriceHistory", back_populates="product", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="product", cascade="all, delete-orphan", order_by="Image.id")

    embedding = relationship("Embedding", uselist=False, cascade="all, delete-orphan", back_populates="product")


class ProductVariant(Base):
    __tablename__ = "product_variant"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True)

    sku = Column(String(128), nullable=True, index=True)
    color = Column(String(64), nullable=True)
    size = Column(String(64), nullable=True)
    material = Column(String(128), nullable=True)
    pattern = Column(String(128), nullable=True)
    fit = Column(String(128), nullable=True)
    length = Column(String(128), nullable=True)
    heel_height = Column(String(128), nullable=True)
    image_url = Column(Text, nullable=True)
    stock_status = Column(String(32), nullable=True)
    attributes = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    source_name = Column(String(64), nullable=True, index=True)
    source_variant_id = Column(String(255), nullable=True, index=True)
    source_payload_version = Column(String(64), nullable=True)
    ingested_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False, onupdate=func.now())

    product = relationship("Product", back_populates="variants")
    embedding = relationship("VariantEmbedding", uselist=False, cascade="all, delete-orphan", back_populates="variant")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True)

    currency = Column(String(8), nullable=True)
    regular_price = Column(Float, nullable=True)
    sale_price = Column(Float, nullable=True)
    discount_rate = Column(Float, nullable=True)
    scraped_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    product = relationship("Product", back_populates="prices")

    __table_args__ = (
        # matches ix_price_history_product_scraped_at_desc in DB
        Index("ix_price_history_product_scraped_at_desc", "product_id", text("scraped_at DESC")),
    )


class Image(Base):
    __tablename__ = "image"

    id = Column(Integer, primary_key=True)

    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True, index=True)

    url = Column(Text, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    hash = Column(String(256), nullable=True)

    product = relationship("Product", back_populates="images")
    embedding = relationship("ImageEmbedding", uselist=False, cascade="all, delete-orphan", back_populates="image")
    variant = relationship("ProductVariant")

    __table_args__ = (
        # matches ix_image_product_id_id / ix_image_variant_id_id in DB
        Index("ix_image_product_id_id", "product_id", "id"),
        Index("ix_image_variant_id_id", "variant_id", "id"),
    )


class Embedding(Base):
    __tablename__ = "embedding"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    model_name = Column(String(128), nullable=True)
    dim = Column(Integer, nullable=True)
    vector_path = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    product = relationship("Product", back_populates="embedding")


class VariantEmbedding(Base):
    __tablename__ = "variant_embedding"

    id = Column(Integer, primary_key=True)

    # ✅ fixes alembic trying to set nullable=True
    variant_id = Column(
        Integer,
        ForeignKey("product_variant.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    model_name = Column(String(128), nullable=True, index=True)
    model_version = Column(String(64), nullable=True)
    dim = Column(Integer, nullable=True)

    vector_path = Column(Text, nullable=True)
    embedding = Column(Vector(768), nullable=True)
    fused_embedding = Column(Vector(768), nullable=True)
    embedding_status = Column(String(32), nullable=False, server_default=text("'pending'"), index=True)
    source_fingerprint = Column(String(64), nullable=True)
    text_fingerprint = Column(String(64), nullable=True)
    image_fingerprint = Column(String(64), nullable=True)
    image_count = Column(Integer, nullable=False, server_default=text("0"))
    text_payload_version = Column(Integer, nullable=False, server_default=text("1"))
    fusion_recipe_version = Column(Integer, nullable=False, server_default=text("1"))
    computed_from_image_ids = Column(ARRAY(Integer), nullable=True)
    last_error = Column(Text, nullable=True)
    metadata_json = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))

    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False, onupdate=func.now(), index=True)

    variant = relationship("ProductVariant", back_populates="embedding")

    __table_args__ = (
        Index(
            "idx_variant_embedding_hnsw",
            "fused_embedding",
            postgresql_using="hnsw",
            postgresql_ops={"fused_embedding": "vector_cosine_ops"},
        ),
    )


class ImageEmbedding(Base):
    __tablename__ = "image_embedding"

    id = Column(Integer, primary_key=True)

    # ✅ fixes alembic trying to set nullable=True
    image_id = Column(
        Integer,
        ForeignKey("image.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    model_name = Column(String(128), nullable=True, index=True)
    dim = Column(Integer, nullable=True)
    vector_path = Column(Text, nullable=True)

    embedding = Column(Vector(768), nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    image = relationship("Image", back_populates="embedding")

    __table_args__ = (
        # ✅ HNSW index (prevents alembic drop)
        Index(
            "idx_image_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


# -- User Auth & Closets & Favorite Brands --

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True)
    auth0_id = Column(String(255), unique=True, nullable=False, index=True)

    email = Column(String(255), nullable=True, index=True)
    name = Column(String(128), nullable=True)
    profile_picture_url = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    closets = relationship("Closet", back_populates="user", cascade="all, delete-orphan")

    favorite_brands = relationship(
        "FavoriteBrand",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class FavoriteBrand(Base):
    __tablename__ = "favorite_brand"

    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    brand_id = Column(Integer, ForeignKey("brand.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="favorite_brands")
    brand = relationship("Brand")

    __table_args__ = (
        Index("ix_favorite_brand_user_id", "user_id"),
        Index("ix_favorite_brand_brand_id", "brand_id"),
    )


# -- Search logging --

class SearchResultCache(Base):
    __tablename__ = "search_result_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)

    mode = Column(String(16), nullable=False, server_default=text("'image'"))
    query_hash = Column(String(64), nullable=True, index=True)

    product_ids = Column(ARRAY(Integer), nullable=True)
    variant_ids = Column(ARRAY(Integer), nullable=True)
    scores = Column(ARRAY(Float), nullable=True)
    meta = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))

    __table_args__ = (
        Index("ix_search_result_cache_created_expires", "created_at", "expires_at"),
    )


class SearchSession(Base):
    __tablename__ = "search_session"

    id = Column(Integer, primary_key=True)

    user_id = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)
    query_text = Column(Text, nullable=True)
    query_image_id = Column(Integer, ForeignKey("image.id", ondelete="SET NULL"), nullable=True, index=True)

    mode = Column(String(16), nullable=False, server_default=text("'multimodal'"))
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    query_hash = Column(String(64), nullable=True, index=True)
    filters = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    latency_ms = Column(Integer, nullable=True)
    k = Column(Integer, nullable=True)

    # ✅ match DB behavior (your downgrade recreates fk with SET NULL)
    result_cache_id = Column(
        UUID(as_uuid=True),
        ForeignKey("search_result_cache.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    user = relationship("User")
    query_image = relationship("Image")
    result_cache = relationship("SearchResultCache")

    events = relationship("SearchEvent", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_search_session_user_created_at", "user_id", "created_at"),
        Index("ix_search_session_user_query_hash_created_at", "user_id", "query_hash", "created_at"),
    )


class SearchEvent(Base):
    __tablename__ = "search_event"

    id = Column(Integer, primary_key=True)

    # ✅ fixes alembic trying to set nullable=True
    session_id = Column(
        Integer,
        ForeignKey("search_session.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # nullable user_id should SET NULL on delete (matches your downgrade)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)

    event_type = Column(String(32), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True, index=True)

    position = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    impression_key = Column(String(64), nullable=True)

    session = relationship("SearchSession", back_populates="events")
    user = relationship("User")
    product = relationship("Product")
    variant = relationship("ProductVariant")

    __table_args__ = (
        Index("ix_search_event_session_created_at", "session_id", "created_at"),
        Index("ix_search_event_user_created_at", "user_id", "created_at"),
        Index("ix_search_event_type_created_at", "event_type", "created_at"),
        Index("ix_search_event_product_type_created_at", "product_id", "event_type", "created_at"),

        # ✅ partial unique dedupe for impressions
        Index(
            "uq_search_event_impression_dedupe",
            "session_id",
            "product_id",
            "impression_key",
            unique=True,
            postgresql_where=text("(event_type = 'impression') AND (impression_key IS NOT NULL)"),
        ),
    )


# -- Closets --


class Closet(Base):
    __tablename__ = "closet"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)

    # ✅ Tokens for sharing (innately private architecture)
    view_token = Column(String(64), unique=True, nullable=True, index=True)
    edit_token = Column(String(64), unique=True, nullable=True, index=True)

    slug = Column(String(255), nullable=False, index=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False, onupdate=func.now())

    user = relationship("User", back_populates="closets")
    items = relationship("ClosetItem", back_populates="closet", cascade="all, delete-orphan")
    outfits = relationship("Outfit", back_populates="closet", cascade="all, delete-orphan")
    collaborators = relationship("ClosetCollaborator", back_populates="closet", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "slug", name="uq_closet_user_slug"),
    )


class ClosetCollaborator(Base):
    __tablename__ = "closet_collaborator"

    closet_id = Column(Integer, ForeignKey("closet.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    
    # 'viewer' or 'editor'
    role = Column(String(32), nullable=False, server_default=text("'viewer'"))
    
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    closet = relationship("Closet", back_populates="collaborators")
    user = relationship("User")



class ClosetItem(Base):
    __tablename__ = "closet_item"

    id = Column(Integer, primary_key=True)
    closet_id = Column(Integer, ForeignKey("closet.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True, index=True)

    added_at = Column(DateTime, server_default=func.now(), nullable=False)

    closet = relationship("Closet", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")

    __table_args__ = (
        Index("ix_closet_item_closet_added_at_desc", "closet_id", text("added_at DESC")),
    )


# curated closets

class CuratedCloset(Base):
    __tablename__ = "curated_closet"

    id = Column(Integer, primary_key=True)
    title = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    hero_image_url = Column(Text, nullable=True)

    user_id = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)

    source = Column(String(32), nullable=False, server_default=text("'cluster'"))
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    user = relationship("User")
    items = relationship("CuratedClosetItem", back_populates="curated_closet", cascade="all, delete-orphan")


class CuratedClosetItem(Base):
    __tablename__ = "curated_closet_item"

    id = Column(Integer, primary_key=True)

    # ✅ fixes alembic trying to set nullable=True
    curated_closet_id = Column(
        Integer,
        ForeignKey("curated_closet.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ✅ fixes alembic trying to set nullable=True
    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True, index=True)

    rank = Column(Integer, nullable=True, index=True)

    curated_closet = relationship("CuratedCloset", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")

    __table_args__ = (
        # ✅ matches your partial unique indexes in DB
        Index(
            "uq_curated_item_variant",
            "curated_closet_id",
            "variant_id",
            unique=True,
            postgresql_where=text("variant_id IS NOT NULL"),
        ),
        Index(
            "uq_curated_item_product_no_variant",
            "curated_closet_id",
            "product_id",
            unique=True,
            postgresql_where=text("variant_id IS NULL"),
        ),
    )


# curated closets cache

class ClosetRecoCache(Base):
    __tablename__ = "closet_reco_cache"

    id = Column(Integer, primary_key=True)

    # ✅ fixes alembic trying to set nullable=True
    closet_id = Column(Integer, ForeignKey("closet.id", ondelete="CASCADE"), nullable=False, index=True)

    model_name = Column(String(128), nullable=True)
    generated_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    payload_json = Column(Text, nullable=True)

    closet = relationship("Closet")


# -- outfits --

class Outfit(Base):
    __tablename__ = "outfit"

    id = Column(Integer, primary_key=True)
    closet_id = Column(Integer, ForeignKey("closet.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(128), nullable=True)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False, onupdate=func.now())

    closet = relationship("Closet", back_populates="outfits")
    items = relationship("OutfitItem", back_populates="outfit", cascade="all, delete-orphan")


class OutfitItem(Base):
    __tablename__ = "outfit_item"

    id = Column(Integer, primary_key=True)
    outfit_id = Column(Integer, ForeignKey("outfit.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id = Column(Integer, ForeignKey("product_variant.id", ondelete="SET NULL"), nullable=True)

    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)

    outfit = relationship("Outfit", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")
