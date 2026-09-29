"""add similarity scores to search cache

Revision ID: a7b18b1cda9c
Revises: dc8d08459cdd
Create Date: 2026-01-29 12:20:40.206356

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a7b18b1cda9c'
down_revision: Union[str, Sequence[str], None] = 'dc8d08459cdd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column(
        "search_result_cache",
        sa.Column("scores", postgresql.ARRAY(sa.Float()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("search_result_cache", "scores")
