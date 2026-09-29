"""Add name to ProductVariant

Revision ID: a0d839a904ab
Revises: a78a5c1ade43
Create Date: 2026-04-10 09:24:58.104119

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a0d839a904ab'
down_revision: Union[str, Sequence[str], None] = 'a78a5c1ade43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
