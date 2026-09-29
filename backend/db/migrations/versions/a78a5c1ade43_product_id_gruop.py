"""product id gruop

Revision ID: a78a5c1ade43
Revises: 44d2f0fee65e
Create Date: 2026-04-07 15:23:57.686276

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a78a5c1ade43'
down_revision: Union[str, Sequence[str], None] = '44d2f0fee65e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('product', sa.Column('group_id', sa.String(length=128), nullable=True))
    op.create_index(op.f('ix_product_group_id'), 'product', ['group_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_product_group_id'), table_name='product')
    op.drop_column('product', 'group_id')
