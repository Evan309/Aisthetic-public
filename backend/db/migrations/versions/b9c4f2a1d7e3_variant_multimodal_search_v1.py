"""variant multimodal search v1

Revision ID: b9c4f2a1d7e3
Revises: a0d839a904ab
Create Date: 2026-04-10 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b9c4f2a1d7e3"
down_revision: Union[str, Sequence[str], None] = "a0d839a904ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DIM = 768


def upgrade() -> None:
    op.add_column("product_variant", sa.Column("pattern", sa.String(length=128), nullable=True))
    op.add_column("product_variant", sa.Column("fit", sa.String(length=128), nullable=True))
    op.add_column("product_variant", sa.Column("length", sa.String(length=128), nullable=True))
    op.add_column("product_variant", sa.Column("heel_height", sa.String(length=128), nullable=True))
    op.add_column(
        "product_variant",
        sa.Column(
            "attributes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column("product_variant", sa.Column("source_name", sa.String(length=64), nullable=True))
    op.add_column("product_variant", sa.Column("source_variant_id", sa.String(length=255), nullable=True))
    op.add_column("product_variant", sa.Column("source_payload_version", sa.String(length=64), nullable=True))
    op.add_column(
        "product_variant",
        sa.Column("ingested_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.add_column(
        "product_variant",
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(op.f("ix_product_variant_source_name"), "product_variant", ["source_name"], unique=False)
    op.create_index(op.f("ix_product_variant_source_variant_id"), "product_variant", ["source_variant_id"], unique=False)
    op.create_index(op.f("ix_product_variant_ingested_at"), "product_variant", ["ingested_at"], unique=False)

    op.add_column("search_result_cache", sa.Column("variant_ids", postgresql.ARRAY(sa.Integer()), nullable=True))
    op.alter_column("search_result_cache", "product_ids", existing_type=postgresql.ARRAY(sa.Integer()), nullable=True)

    op.add_column("variant_embedding", sa.Column("model_version", sa.String(length=64), nullable=True))
    op.add_column(
        "variant_embedding",
        sa.Column("embedding_status", sa.String(length=32), nullable=False, server_default=sa.text("'pending'")),
    )
    op.add_column("variant_embedding", sa.Column("source_fingerprint", sa.String(length=64), nullable=True))
    op.add_column("variant_embedding", sa.Column("text_fingerprint", sa.String(length=64), nullable=True))
    op.add_column("variant_embedding", sa.Column("image_fingerprint", sa.String(length=64), nullable=True))
    op.add_column(
        "variant_embedding",
        sa.Column("image_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "variant_embedding",
        sa.Column("text_payload_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column(
        "variant_embedding",
        sa.Column("fusion_recipe_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column("variant_embedding", sa.Column("computed_from_image_ids", postgresql.ARRAY(sa.Integer()), nullable=True))
    op.add_column("variant_embedding", sa.Column("last_error", sa.Text(), nullable=True))
    op.add_column(
        "variant_embedding",
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "variant_embedding",
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(op.f("ix_variant_embedding_embedding_status"), "variant_embedding", ["embedding_status"], unique=False)
    op.create_index(op.f("ix_variant_embedding_updated_at"), "variant_embedding", ["updated_at"], unique=False)

    op.execute(f"ALTER TABLE variant_embedding ADD COLUMN fused_embedding vector({DIM});")
    op.execute("UPDATE variant_embedding SET fused_embedding = embedding WHERE fused_embedding IS NULL AND embedding IS NOT NULL;")
    op.execute("DROP INDEX IF EXISTS idx_variant_embedding_hnsw;")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_variant_embedding_hnsw
        ON variant_embedding
        USING hnsw (fused_embedding vector_cosine_ops);
        """
    )
def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_variant_embedding_hnsw;")
    op.execute("DROP COLUMN IF EXISTS fused_embedding FROM variant_embedding;")

    op.drop_index(op.f("ix_variant_embedding_updated_at"), table_name="variant_embedding")
    op.drop_index(op.f("ix_variant_embedding_embedding_status"), table_name="variant_embedding")
    op.drop_column("variant_embedding", "updated_at")
    op.drop_column("variant_embedding", "metadata_json")
    op.drop_column("variant_embedding", "last_error")
    op.drop_column("variant_embedding", "computed_from_image_ids")
    op.drop_column("variant_embedding", "fusion_recipe_version")
    op.drop_column("variant_embedding", "text_payload_version")
    op.drop_column("variant_embedding", "image_count")
    op.drop_column("variant_embedding", "image_fingerprint")
    op.drop_column("variant_embedding", "text_fingerprint")
    op.drop_column("variant_embedding", "source_fingerprint")
    op.drop_column("variant_embedding", "embedding_status")
    op.drop_column("variant_embedding", "model_version")

    op.alter_column("search_result_cache", "product_ids", existing_type=postgresql.ARRAY(sa.Integer()), nullable=False)
    op.drop_column("search_result_cache", "variant_ids")

    op.drop_index(op.f("ix_product_variant_ingested_at"), table_name="product_variant")
    op.drop_index(op.f("ix_product_variant_source_variant_id"), table_name="product_variant")
    op.drop_index(op.f("ix_product_variant_source_name"), table_name="product_variant")
    op.drop_column("product_variant", "updated_at")
    op.drop_column("product_variant", "ingested_at")
    op.drop_column("product_variant", "source_payload_version")
    op.drop_column("product_variant", "source_variant_id")
    op.drop_column("product_variant", "source_name")
    op.drop_column("product_variant", "attributes")
    op.drop_column("product_variant", "heel_height")
    op.drop_column("product_variant", "length")
    op.drop_column("product_variant", "fit")
    op.drop_column("product_variant", "pattern")
