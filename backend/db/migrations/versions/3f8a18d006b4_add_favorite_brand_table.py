"""add favorite brand table

Revision ID: 3f8a18d006b4
Revises: a7b18b1cda9c
Create Date: 2026-01-30 11:02:39.413680

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f8a18d006b4'
down_revision: Union[str, Sequence[str], None] = 'a7b18b1cda9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "favorite_brand",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("brand_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["brand_id"], ["brand.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "brand_id"),
    )
    op.create_index("ix_favorite_brand_brand_id", "favorite_brand", ["brand_id"], unique=False)
    op.create_index("ix_favorite_brand_user_id", "favorite_brand", ["user_id"], unique=False)

def downgrade() -> None:
    op.drop_index("ix_favorite_brand_user_id", table_name="favorite_brand")
    op.drop_index("ix_favorite_brand_brand_id", table_name="favorite_brand")
    op.drop_table("favorite_brand")
