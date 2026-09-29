"""Add public closets, slug, outfits, and outfit items

Revision ID: a1b2c3d4e5f6
Revises: <previous_revision_here>
Create Date: 2025-12-05

"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers
revision = "a1b2c3d4e5f6"
down_revision = "35d6be0bffd8" 
branch_labels = None
depends_on = None


def upgrade():
    # ----------------------
    # Modify Closet table
    # ----------------------
    op.add_column("closet", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("closet", sa.Column("is_public", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("closet", sa.Column("slug", sa.String(length=255), nullable=True))
    op.add_column("closet", sa.Column("updated_at", sa.DateTime(), onupdate=sa.func.now()))

    # Add unique constraint (user_id, slug)
    op.create_unique_constraint(
        "uq_closet_user_slug", "closet", ["user_id", "slug"]
    )

    # ----------------------
    # Create Outfit table
    # ----------------------
    op.create_table(
        "outfit",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("closet_id", sa.Integer(), sa.ForeignKey("closet.id"), index=True),
        sa.Column("name", sa.String(128), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), onupdate=sa.func.now()),
    )

    # ----------------------
    # Create OutfitItem table
    # ----------------------
    op.create_table(
        "outfit_item",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("outfit_id", sa.Integer(), sa.ForeignKey("outfit.id"), index=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("product.id"), index=True),
        sa.Column("variant_id", sa.Integer(), sa.ForeignKey("product_variant.id"), nullable=True),

        # Optional drag & drop coordinates
        sa.Column("position_x", sa.Float(), nullable=True),
        sa.Column("position_y", sa.Float(), nullable=True),
    )


def downgrade():
    # ----------------------
    # Drop OutfitItem
    # ----------------------
    op.drop_table("outfit_item")

    # ----------------------
    # Drop Outfit
    # ----------------------
    op.drop_table("outfit")

    # ----------------------
    # Remove unique constraint
    # ----------------------
    op.drop_constraint("uq_closet_user_slug", "closet", type_="unique")

    # ----------------------
    # Remove Closet columns
    # ----------------------
    op.drop_column("closet", "updated_at")
    op.drop_column("closet", "slug")
    op.drop_column("closet", "is_public")
    op.drop_column("closet", "description")
