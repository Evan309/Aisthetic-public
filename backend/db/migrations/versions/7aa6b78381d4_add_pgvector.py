"""phase1: pgvector columns + ANN indexes

Revision ID: 7aa6b78381d4
Revises: 4730bd991d93
Create Date: 2026-01-08 20:49:35.560380

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7aa6b78381d4'
down_revision: Union[str, Sequence[str], None] = '4730bd991d93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DIM = 768

def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # Add columns (idempotent-ish, only if you’re sure they don't exist yet)
    op.execute(f"ALTER TABLE image_embedding ADD COLUMN embedding vector({DIM});")
    op.execute(f"ALTER TABLE variant_embedding ADD COLUMN embedding vector({DIM});")

    # ANN indexes
    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_image_embedding_hnsw
    ON image_embedding
    USING hnsw (embedding vector_cosine_ops);
    """)

    op.execute("""
    CREATE INDEX IF NOT EXISTS idx_variant_embedding_hnsw
    ON variant_embedding
    USING hnsw (embedding vector_cosine_ops);
    """)

def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_variant_embedding_hnsw;")
    op.execute("DROP INDEX IF EXISTS idx_image_embedding_hnsw;")

    # Drop columns
    op.drop_column("variant_embedding", "embedding")
    op.drop_column("image_embedding", "embedding")

    # Do NOT drop the extension in downgrade (usually shared / harmless)