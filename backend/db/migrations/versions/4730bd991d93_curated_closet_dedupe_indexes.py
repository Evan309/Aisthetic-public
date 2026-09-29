"""curated closet dedupe indexes

Revision ID: 4730bd991d93
Revises: 2380fd846285
Create Date: 2026-01-07 15:53:52.528353

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4730bd991d93'
down_revision: Union[str, Sequence[str], None] = '2380fd846285'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade():
    op.create_index(
        "uq_curated_item_variant",
        "curated_closet_item",
        ["curated_closet_id", "variant_id"],
        unique=True,
        postgresql_where=sa.text("variant_id IS NOT NULL"),
    )

    op.create_index(
        "uq_curated_item_product_no_variant",
        "curated_closet_item",
        ["curated_closet_id", "product_id"],
        unique=True,
        postgresql_where=sa.text("variant_id IS NULL"),
    )

def downgrade():
    op.drop_index("uq_curated_item_product_no_variant", table_name="curated_closet_item")
    op.drop_index("uq_curated_item_variant", table_name="curated_closet_item")