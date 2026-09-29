"""add closets + outfits feature

Revision ID: a78ec56b1414
Revises: a1b2c3d4e5f6
Create Date: 2025-12-05 15:17:53.278672
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a78ec56b1414"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop leftover dev table (not in models)
    op.drop_table("playing_with_neon")

    # closet.is_public should match model: Boolean default False, NOT NULL
    # (DB default is server_default; model default is Python-side, but keeping server_default helps.)
    op.alter_column(
        "closet",
        "is_public",
        existing_type=sa.BOOLEAN(),
        nullable=False,
        server_default=sa.text("false"),
        existing_server_default=sa.text("false"),
    )

    # closet.slug is indexed in model
    op.create_index(op.f("ix_closet_slug"), "closet", ["slug"], unique=False)

    # user.auth0_id exists in model (unique + index)
    op.add_column("user", sa.Column("auth0_id", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_user_auth0_id"), "user", ["auth0_id"], unique=True)

    # user.email in model is indexed but NOT unique
    # Current DB has unique index ix_user_email, so change it to non-unique.
    op.drop_index("ix_user_email", table_name="user")
    op.create_index(op.f("ix_user_email"), "user", ["email"], unique=False)

    # password_hash is NOT in your model, so remove it
    op.drop_column("user", "password_hash")


def downgrade() -> None:
    # Re-add password_hash (undo upgrade)
    op.add_column("user", sa.Column("password_hash", sa.VARCHAR(length=255), nullable=True))

    # Revert email index back to UNIQUE (matches your pre-migration DB state)
    op.drop_index(op.f("ix_user_email"), table_name="user")
    op.create_index("ix_user_email", "user", ["email"], unique=True)

    # Drop auth0_id + its unique index
    op.drop_index(op.f("ix_user_auth0_id"), table_name="user")
    op.drop_column("user", "auth0_id")

    # Drop closet slug index
    op.drop_index(op.f("ix_closet_slug"), table_name="closet")

    # Revert closet.is_public nullability (pre-migration state)
    op.alter_column(
        "closet",
        "is_public",
        existing_type=sa.BOOLEAN(),
        nullable=True,
        server_default=sa.text("false"),
        existing_server_default=sa.text("false"),
    )

    # Recreate dev table (pre-migration state)
    op.create_table(
        "playing_with_neon",
        sa.Column("id", sa.INTEGER(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("name", sa.TEXT(), nullable=False),
        sa.Column("value", sa.REAL(), nullable=True),
    )
