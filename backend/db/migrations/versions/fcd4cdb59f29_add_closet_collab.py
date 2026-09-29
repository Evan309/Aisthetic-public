"""add closet collaborators + share tokens (minimal)

Revision ID: fcd4cdb59f29
Revises: 3f8a18d006b4
Create Date: 2026-02-08 12:26:53.353092
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "fcd4cdb59f29"
down_revision: Union[str, Sequence[str], None] = "3f8a18d006b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Create collaborator join table (closet <-> user)
    op.create_table(
        "closet_collaborator",
        sa.Column("closet_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "role",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'viewer'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["closet_id"],
            ["closet.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("closet_id", "user_id"),
    )

    # 2) Add share tokens to closet (nullable so existing rows are safe)
    op.add_column("closet", sa.Column("view_token", sa.String(length=64), nullable=True))
    op.add_column("closet", sa.Column("edit_token", sa.String(length=64), nullable=True))

    # 3) Unique indexes for tokens (Postgres allows multiple NULLs in UNIQUE index)
    op.create_index("ix_closet_view_token", "closet", ["view_token"], unique=True)
    op.create_index("ix_closet_edit_token", "closet", ["edit_token"], unique=True)

    op.drop_column("closet", "is_public")


def downgrade() -> None:
    op.add_column(
        "closet",
        sa.Column(
            "is_public",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    op.drop_index("ix_closet_edit_token", table_name="closet")
    op.drop_index("ix_closet_view_token", table_name="closet")
    op.drop_column("closet", "edit_token")
    op.drop_column("closet", "view_token")

    op.drop_table("closet_collaborator")
