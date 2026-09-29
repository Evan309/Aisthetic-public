import random
from sqlalchemy.orm import Session
from sqlalchemy import select

from db.session import SessionLocal
from db.models import (
    CuratedCloset,
    CuratedClosetItem,
    Product,
    Image,
)

THEMES = [
    "Minimal Everyday Essentials",
    "Streetwear Staples",
    "Soft Neutrals",
    "Monochrome Fits",
    "Effortless Summer",
    "Cozy Layers",
    "Clean Girl Aesthetic",
    "Modern Tailoring",
    "Casual Weekend",
    "Fancy Professional",
]

ITEMS_PER_CLOSET = 96


def pick_hero_image(db: Session, product_id: int) -> str | None:
    row = db.execute(
        select(Image.url)
        .where(Image.product_id == product_id)
        .order_by(Image.id.asc())
        .limit(1)
    ).first()
    return row[0] if row else None


def main():
    db: Session = SessionLocal()

    try:
        all_products = db.execute(
            select(Product.id)
            .where(Product.is_available.is_(True))
        ).scalars().all()

        if len(all_products) < ITEMS_PER_CLOSET:
            raise RuntimeError("Not enough products to generate curated closets")

        for theme in THEMES:
            product_ids = random.sample(all_products, ITEMS_PER_CLOSET)

            hero_image = pick_hero_image(db, product_ids[0])

            curated = CuratedCloset(
                title=theme,
                description=f"A curated selection inspired by {theme.lower()}.",
                hero_image_url=hero_image,
                source="seed",
                user_id=None,
            )
            db.add(curated)
            db.flush()  # get curated.id

            items = []
            for rank, pid in enumerate(product_ids, start=1):
                items.append(
                    CuratedClosetItem(
                        curated_closet_id=curated.id,
                        product_id=pid,
                        rank=rank,
                    )
                )

            db.add_all(items)
            db.commit()

            print(f"✅ Created curated closet: {theme}")

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
