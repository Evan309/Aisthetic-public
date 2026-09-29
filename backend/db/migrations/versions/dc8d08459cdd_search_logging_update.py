"""search logging update

Revision ID: dc8d08459cdd
Revises: 7e95562952a5
Create Date: 2026-01-21 16:05:53.273517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'dc8d08459cdd'
down_revision: Union[str, Sequence[str], None] = '7e95562952a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # -------------------------
    # search_session updates
    # -------------------------
    op.add_column("search_session", sa.Column("query_hash", sa.String(length=64), nullable=True))
    op.add_column(
        "search_session",
        sa.Column(
            "filters",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column("search_session", sa.Column("latency_ms", sa.Integer(), nullable=True))
    op.add_column("search_session", sa.Column("k", sa.Integer(), nullable=True))
    op.add_column("search_session", sa.Column("result_cache_id", postgresql.UUID(as_uuid=True), nullable=True))

    op.create_index("ix_search_session_query_hash", "search_session", ["query_hash"])
    op.create_index("ix_search_session_user_created_at", "search_session", ["user_id", "created_at"])
    op.create_index("ix_search_session_user_query_hash_created_at", "search_session", ["user_id", "query_hash", "created_at"])
    op.create_index("ix_search_session_result_cache_id", "search_session", ["result_cache_id"])

    op.create_foreign_key(
        "fk_search_session_result_cache_id",
        "search_session",
        "search_result_cache",
        ["result_cache_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # -------------------------
    # search_event updates
    # -------------------------
    op.add_column("search_event", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("search_event", sa.Column("impression_key", sa.String(length=64), nullable=True))

    op.create_index("ix_search_event_user_id", "search_event", ["user_id"])
    op.create_index("ix_search_event_session_created_at", "search_event", ["session_id", "created_at"])
    op.create_index("ix_search_event_user_created_at", "search_event", ["user_id", "created_at"])
    op.create_index("ix_search_event_type_created_at", "search_event", ["event_type", "created_at"])
    op.create_index("ix_search_event_product_type_created_at", "search_event", ["product_id", "event_type", "created_at"])

    op.create_foreign_key(
        "fk_search_event_user_id",
        "search_event",
        "user",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ✅ Partial unique index to dedupe impressions only:
    # prevents multiple impression logs for same (session, product, impression_key)
    op.create_index(
        "uq_search_event_impression_dedupe",
        "search_event",
        ["session_id", "product_id", "impression_key"],
        unique=True,
        postgresql_where=sa.text("event_type = 'impression' AND impression_key IS NOT NULL"),
    )


def downgrade():
    # drop partial unique index first
    op.drop_index("uq_search_event_impression_dedupe", table_name="search_event")

    # drop search_event indexes + fks + columns
    op.drop_constraint("fk_search_event_user_id", "search_event", type_="foreignkey")
    op.drop_index("ix_search_event_product_type_created_at", table_name="search_event")
    op.drop_index("ix_search_event_type_created_at", table_name="search_event")
    op.drop_index("ix_search_event_user_created_at", table_name="search_event")
    op.drop_index("ix_search_event_session_created_at", table_name="search_event")
    op.drop_index("ix_search_event_user_id", table_name="search_event")
    op.drop_column("search_event", "impression_key")
    op.drop_column("search_event", "user_id")

    # drop search_session fks + indexes + columns
    op.drop_constraint("fk_search_session_result_cache_id", "search_session", type_="foreignkey")
    op.drop_index("ix_search_session_result_cache_id", table_name="search_session")
    op.drop_index("ix_search_session_user_query_hash_created_at", table_name="search_session")
    op.drop_index("ix_search_session_user_created_at", table_name="search_session")
    op.drop_index("ix_search_session_query_hash", table_name="search_session")

    op.drop_column("search_session", "result_cache_id")
    op.drop_column("search_session", "k")
    op.drop_column("search_session", "latency_ms")
    op.drop_column("search_session", "filters")
    op.drop_column("search_session", "query_hash")