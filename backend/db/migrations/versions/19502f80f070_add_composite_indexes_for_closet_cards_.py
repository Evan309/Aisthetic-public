from alembic import op

# revision identifiers, used by Alembic.
revision = "ADD_COMPOSITE_INDEXES"
down_revision = "a78ec56b1414"
branch_labels = None
depends_on = None


def upgrade():
    # 1) Latest price per product (critical for DISTINCT ON / newest price)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_price_history_product_scraped_at_desc
        ON price_history (product_id, scraped_at DESC);
    """)

    # 2) Closet items ordered newest-first (critical for closet grid)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_closet_item_closet_added_at_desc
        ON closet_item (closet_id, added_at DESC);
    """)

    # 3) Primary image lookup (variant-level)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_image_variant_id_id
        ON image (variant_id, id);
    """)

    # 4) Primary image lookup (product-level)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_image_product_id_id
        ON image (product_id, id);
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_image_product_id_id;")
    op.execute("DROP INDEX IF EXISTS ix_image_variant_id_id;")
    op.execute("DROP INDEX IF EXISTS ix_closet_item_closet_added_at_desc;")
    op.execute("DROP INDEX IF EXISTS ix_price_history_product_scraped_at_desc;")
