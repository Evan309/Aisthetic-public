import time
import datetime
import logging
import pandas as pd
import os

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)

timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
save_path = f"{os.getenv('MUSINSA_SAVE_PATH')}/musinsa_clothing_{timestamp}.csv"

BASE_URL = "https://global.musinsa.com"
CATEGORY_URL = f"{BASE_URL}/us/category/clothing?page="


def maybe_close_popups(page):
    """Best-effort close of cookie/region modals so scrolling works."""
    for text in ["Accept", "Agree", "OK"]:
        try:
            page.locator(f"button:has-text('{text}')").first.click(timeout=1000)
        except Exception:
            continue


def extract_visible_batch(page, seen_ids, results):
    """Extract currently mounted products (handles virtualized DOM)."""
    cards = page.locator("li[data-product-id]")
    n = cards.count()
    new_count = 0
    for i in range(n):
        li = cards.nth(i)
        try:
            pid = li.get_attribute("data-product-id")
            if not pid or pid in seen_ids:
                continue

            a = li.locator("a[data-goods-nm]").first
            if not a.count():
                continue

            product_name = a.get_attribute("data-goods-nm")
            brand = a.get_attribute("data-goods-brand")
            price = a.get_attribute("data-goods-price")
            original_price = a.get_attribute("data-goods-normalprice")
            href = a.get_attribute("href")
            img_url = a.get_attribute("data-goods-image-src")

            if img_url and img_url.startswith("//"):
                img_url = "https:" + img_url
            link = BASE_URL + href if href else None

            results.append({
                "product_id": pid,
                "product_name": product_name,
                "brand": brand,
                "price": price,
                "original_price": original_price,
                "discount_rate": li.get_attribute("data-discount-rate"),
                "link": link,
                "image": img_url,
            })
            seen_ids.add(pid)
            new_count += 1
            logging.info(f"Scraped: {product_name}")
        except Exception:
            continue
    return new_count


# === Main Scraper ===
def scrape_all_clothing(max_items=10000):
    results = []
    seen_ids = set()
    page_num = 1

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=40)
        context = browser.new_context(
            viewport={"width": 1440, "height": 1200},
            user_agent=("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36")
        )

        context.add_cookies([{
            "name": "lang",
            "value": "en",
            "domain": "global.musinsa.com",
            "path": "/"
        }])

        page = context.new_page()

        while len(results) < max_items:
            url = CATEGORY_URL + str(page_num)
            logging.info(f"Scraping page {page_num} ({len(results)} items so far)")
            try:
                page.goto(url, timeout=90000, wait_until="domcontentloaded")
                maybe_close_popups(page)
                page.wait_for_selector("li[data-product-id]", timeout=30000)
            except PWTimeoutError as e:
                logging.error(f"Timeout loading page {page_num}: {e}")
                break
            except Exception as e:
                logging.error(f"Error loading page {page_num}: {e}")
                break

            logging.info(f"Scrolling through all products on page {page_num}...")

            max_steps = 250
            pause_s = 0.8
            stable_streak = 0
            prev_seen_total = len(seen_ids)

            for step in range(max_steps):
                newly_added = extract_visible_batch(page, seen_ids, results)

                page.keyboard.press("PageDown")
                page.evaluate("""
                    () => {
                        const grid = document.querySelector('ul[data-product-list], #globalMain ul, .sc-bcd77a3f-2');
                        if (grid) grid.scrollBy(0, window.innerHeight * 0.8);
                        else window.scrollBy(0, window.innerHeight * 0.8);
                    }
                """)
                time.sleep(pause_s)

                try:
                    page.wait_for_load_state("networkidle", timeout=2000)
                except Exception:
                    pass

                if newly_added == 0:
                    stable_streak += 1
                else:
                    stable_streak = 0

                if stable_streak >= 8:
                    logging.info(f"✅ Finished scrolling after {step+1} scrolls (total {len(seen_ids)} items).")
                    break

                if len(results) >= max_items:
                    break

            extract_visible_batch(page, seen_ids, results)

            if len(seen_ids) == prev_seen_total:
                logging.info(f"No new products found on page {page_num}. Stopping.")
                break

            logging.info(f"✅ Page {page_num} total collected so far: {len(seen_ids)}")
            page_num += 1

        browser.close()

    df = pd.DataFrame(results)
    df.to_csv(save_path, index=False)
    logging.info(f"\n✅ Scraped {len(df)} total products.")
    logging.info(f"📁 Saved to: {save_path}")
    return df


if __name__ == "__main__":
    scrape_all_clothing(10000)
