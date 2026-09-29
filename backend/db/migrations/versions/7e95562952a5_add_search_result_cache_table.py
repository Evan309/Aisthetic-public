"""add search result cache table

Revision ID: 7e95562952a5
Revises: 7aa6b78381d4
Create Date: 2026-01-13 13:33:52.994552

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7e95562952a5'
down_revision: Union[str, Sequence[str], None] = '7aa6b78381d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    # Needed for gen_random_uuid()
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    op.create_table(
        "search_result_cache",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "mode",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'image'"),
        ),
        sa.Column(
            "query_hash",
            sa.String(length=64),
            nullable=True,
        ),
        sa.Column(
            "product_ids",
            postgresql.ARRAY(sa.Integer()),
            nullable=False,
        ),
        sa.Column(
            "meta",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_index(
        "ix_search_result_cache_created_at",
        "search_result_cache",
        ["created_at"],
    )
    op.create_index(
        "ix_search_result_cache_expires_at",
        "search_result_cache",
        ["expires_at"],
    )
    op.create_index(
        "ix_search_result_cache_query_hash",
        "search_result_cache",
        ["query_hash"],
    )
    op.create_index(
        "ix_search_result_cache_created_expires",
        "search_result_cache",
        ["created_at", "expires_at"],
    )


def downgrade():
    op.drop_index("ix_search_result_cache_created_expires", table_name="search_result_cache")
    op.drop_index("ix_search_result_cache_query_hash", table_name="search_result_cache")
    op.drop_index("ix_search_result_cache_expires_at", table_name="search_result_cache")
    op.drop_index("ix_search_result_cache_created_at", table_name="search_result_cache")
    op.drop_table("search_result_cache")

    # Optional: don't drop extension on downgrade (shared resource)
    # op.execute("DROP EXTENSION IF EXISTS pgcrypto;")
