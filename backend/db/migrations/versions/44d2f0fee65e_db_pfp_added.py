"""db pfp added

Revision ID: 44d2f0fee65e
Revises: fcd4cdb59f29
Create Date: 2026-02-08 14:52:59.706169
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "44d2f0fee65e"
down_revision: Union[str, Sequence[str], None] = "fcd4cdb59f29"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("user", sa.Column("profile_picture_url", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("user", "profile_picture_url")
