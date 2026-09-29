"""
Smoke-test for MusinsaScraper.

Scrapes a small number of products from EVERY category, then prints
detailed output for visual verification before running a full scrape.

Usage:
    cd backend/tests && python3 test_scraper.py
    # or from project root:
    python3 -m backend.tests.test_scraper

Expected runtime: ~3-5 minutes (headless=False so you can watch)
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from textwrap import indent

# Ensure the backend directory is on sys.path so we can import scraper modules
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from scraper.musinsa_scaper.full_scraper import MusinsaScraper


# ── Configuration ───────────────────────────────────────────────────────────

PRODUCTS_PER_CATEGORY = 3      # small enough to inspect, big enough to validate
MAX_LISTING_PAGES = 2          # don't crawl deep
HEADLESS = False               # watch the browser
CONCURRENCY = 2                # keep it gentle for a test run


# ── Helpers ─────────────────────────────────────────────────────────────────

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def section(title: str) -> None:
    print(f"\n{BOLD}{CYAN}{'═' * 70}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'═' * 70}{RESET}\n")


def ok(msg: str) -> None:
    print(f"  {GREEN}✅ {msg}{RESET}")


def warn(msg: str) -> None:
    print(f"  {YELLOW}⚠️  {msg}{RESET}")


def fail(msg: str) -> None:
    print(f"  {RED}❌ {msg}{RESET}")


def dim(msg: str) -> str:
    return f"{DIM}{msg}{RESET}"


# ── Test Cases ──────────────────────────────────────────────────────────────

def test_stats(results: dict) -> tuple[int, int]:
    """High-level stats validation. Returns (passed, failed)."""
    section("TEST 1: Overall Stats")
    passed = 0
    failed = 0
    stats = results["stats"]

    print(f"  Seed products:       {stats['seed_product_count']}")
    print(f"  All products:        {stats['all_product_count']}")
    print(f"  Failed details:      {stats['failed_detail_count']}")
    print(f"  Failed listings:     {stats['failed_listing_page_count']}")
    print(f"  Listing time:        {stats['listing_scrape_seconds']}s")
    print(f"  Detail time:         {stats['detail_scrape_seconds']}s")
    print()

    # We should have some seeds
    if stats["seed_product_count"] > 0:
        ok(f"Got {stats['seed_product_count']} seed products")
        passed += 1
    else:
        fail("No seed products collected!")
        failed += 1

    # All products should be >= seeds (variants add to it)
    if stats["all_product_count"] >= stats["seed_product_count"]:
        ok(f"all_products ({stats['all_product_count']}) >= seeds ({stats['seed_product_count']})")
        passed += 1
    else:
        fail(f"all_products ({stats['all_product_count']}) < seeds ({stats['seed_product_count']})")
        failed += 1

    # Failure rate should be low
    total_attempted = stats["all_product_count"] + stats["failed_detail_count"]
    if total_attempted > 0:
        fail_rate = stats["failed_detail_count"] / total_attempted * 100
        if fail_rate < 30:
            ok(f"Detail failure rate: {fail_rate:.1f}%")
            passed += 1
        else:
            fail(f"Detail failure rate is high: {fail_rate:.1f}%")
            failed += 1

    return passed, failed


def test_category_coverage(results: dict) -> tuple[int, int]:
    """Verify we got products from every category."""
    section("TEST 2: Category Coverage")
    passed = 0
    failed = 0

    categories_seen: dict[str, int] = {}
    for seed in results["seed_products"]:
        cat = seed.get("source_category_name", "unknown")
        categories_seen[cat] = categories_seen.get(cat, 0) + 1

    expected_categories = {
        "tops", "outerwear", "pants", "dresses_skirts",
        "accessories", "bags", "shoes",
    }

    print(f"  Categories found: {list(categories_seen.keys())}")
    print()

    for cat in sorted(expected_categories):
        count = categories_seen.get(cat, 0)
        if count > 0:
            ok(f"{cat}: {count} seeds")
            passed += 1
        else:
            fail(f"{cat}: 0 seeds — category scraping failed!")
            failed += 1

    return passed, failed


def test_seed_product_fields(results: dict) -> tuple[int, int]:
    """Verify seed products have expected fields populated."""
    section("TEST 3: Seed Product Field Quality")
    passed = 0
    failed = 0

    seeds = results["seed_products"]
    if not seeds:
        fail("No seeds to test")
        return 0, 1

    for seed in seeds[:5]:  # inspect up to 5
        pid = seed["product_id"]
        print(f"\n  {BOLD}Product {pid}{RESET}")
        print(f"    Name:           {seed.get('product_name') or dim('(none)')}")
        print(f"    Brand:          {seed.get('brand_id') or dim('(none)')}")
        print(f"    Price:          {seed.get('price') or dim('(none)')}")
        print(f"    Original Price: {seed.get('original_price') or dim('(none)')}")
        print(f"    URL:            {seed.get('product_url', '')[:80]}")
        print(f"    Category:       {seed.get('source_category_name')}")
        print(f"    Page:           {seed.get('source_page')}")

    # Aggregate check
    has_name = sum(1 for s in seeds if s.get("product_name"))
    has_price = sum(1 for s in seeds if s.get("price"))
    has_url = sum(1 for s in seeds if s.get("product_url"))
    has_brand = sum(1 for s in seeds if s.get("brand_id"))

    print()
    total = len(seeds)

    if has_name == total:
        ok(f"All {total} seeds have product_name")
        passed += 1
    elif has_name > 0:
        warn(f"{has_name}/{total} seeds have product_name")
        passed += 1
    else:
        fail(f"No seeds have product_name")
        failed += 1

    if has_url == total:
        ok(f"All {total} seeds have product_url")
        passed += 1
    else:
        fail(f"Only {has_url}/{total} seeds have product_url")
        failed += 1

    if has_price > total * 0.5:
        ok(f"{has_price}/{total} seeds have price")
        passed += 1
    else:
        warn(f"Only {has_price}/{total} seeds have price")
        failed += 1

    if has_brand > total * 0.5:
        ok(f"{has_brand}/{total} seeds have brand_id")
        passed += 1
    else:
        warn(f"Only {has_brand}/{total} seeds have brand_id")
        failed += 1

    return passed, failed


def test_detail_product_fields(results: dict) -> tuple[int, int]:
    """Verify detail products have images, descriptions, and metadata."""
    section("TEST 4: Detail Product Quality")
    passed = 0
    failed = 0

    products = results["all_products"]
    if not products:
        fail("No detail products to test")
        return 0, 1

    # Show detailed view of up to 5 products
    for product in products[:5]:
        pid = product["product_id"]
        stype = product["source_type"]
        print(f"\n  {BOLD}Product {pid} ({stype}){RESET}")
        print(f"    Name:           {product.get('product_name') or dim('(none)')}")
        print(f"    Brand:          {product.get('brand_id') or dim('(none)')}")
        print(f"    Price:          {product.get('price') or dim('(none)')}")
        print(f"    Images:         {len(product.get('image_urls', []))}")
        for i, url in enumerate(product.get("image_urls", [])[:3]):
            print(f"      [{i}] {url[:90]}...")
        if len(product.get("image_urls", [])) > 3:
            print(f"      ... +{len(product['image_urls']) - 3} more")
        desc = product.get("description_text", "")
        desc_preview = desc[:120] + "..." if len(desc) > 120 else desc
        print(f"    Description:    {desc_preview or dim('(empty)')}")
        print(f"    Desc length:    {len(desc)} chars")
        print(f"    Variants:       {product.get('variant_product_ids', [])}")
        print(f"    Category:       {product.get('source_category_name') or dim('(variant - no cat)')}")
        print(f"    URL:            {product.get('product_url', '')[:80]}")

    # Aggregate checks
    print()
    total = len(products)
    has_images = sum(1 for p in products if p.get("image_urls"))
    has_desc = sum(1 for p in products if p.get("description_text", "").strip())
    has_name = sum(1 for p in products if p.get("product_name"))
    avg_images = sum(len(p.get("image_urls", [])) for p in products) / max(total, 1)
    avg_desc_len = sum(len(p.get("description_text", "")) for p in products) / max(total, 1)

    if has_images > total * 0.7:
        ok(f"{has_images}/{total} products have images (avg {avg_images:.1f}/product)")
        passed += 1
    else:
        fail(f"Only {has_images}/{total} products have images")
        failed += 1

    if has_desc > total * 0.5:
        ok(f"{has_desc}/{total} products have descriptions (avg {avg_desc_len:.0f} chars)")
        passed += 1
    else:
        warn(f"Only {has_desc}/{total} products have descriptions (avg {avg_desc_len:.0f} chars)")
        failed += 1

    if has_name > total * 0.7:
        ok(f"{has_name}/{total} products have names")
        passed += 1
    else:
        fail(f"Only {has_name}/{total} products have names")
        failed += 1

    return passed, failed


def test_variant_discovery(results: dict) -> tuple[int, int]:
    """Check that variants were discovered and have metadata."""
    section("TEST 5: Variant Discovery")
    passed = 0
    failed = 0

    products = results["all_products"]
    seeds = {p["product_id"] for p in products if p["source_type"] == "seed"}
    variants = [p for p in products if p["source_type"] == "variant"]

    products_with_variants = sum(
        1 for p in products if p.get("variant_product_ids")
    )

    print(f"  Seed products:            {len(seeds)}")
    print(f"  Variant products scraped: {len(variants)}")
    print(f"  Products with variants:   {products_with_variants}")
    print()

    if products_with_variants > 0:
        ok(f"{products_with_variants} products have variant links")
        passed += 1
    else:
        warn("No products reported variants (may be normal for small sample)")
        passed += 1  # not a failure for a small test

    # If we do have variants, check their metadata enrichment
    if variants:
        v_has_name = sum(1 for v in variants if v.get("product_name"))
        v_has_images = sum(1 for v in variants if v.get("image_urls"))

        print(f"\n  {BOLD}Variant metadata enrichment:{RESET}")
        for v in variants[:3]:
            print(f"    Variant {v['product_id']}: name={v.get('product_name')!r}, "
                  f"images={len(v.get('image_urls', []))}, "
                  f"brand={v.get('brand_id')!r}")

        print()
        if v_has_name > 0:
            ok(f"{v_has_name}/{len(variants)} variants have enriched names")
            passed += 1
        else:
            warn(f"No variants have enriched names")
            failed += 1

        if v_has_images > 0:
            ok(f"{v_has_images}/{len(variants)} variants have images")
            passed += 1
        else:
            fail(f"No variants have images")
            failed += 1
    else:
        print("  (No variants to test enrichment on)")

    return passed, failed


def test_deduplication(results: dict) -> tuple[int, int]:
    """Verify no duplicate product IDs."""
    section("TEST 6: Deduplication")
    passed = 0
    failed = 0

    seed_ids = results["seed_product_ids"]
    all_ids = results["all_product_ids"]

    seed_dupes = len(seed_ids) - len(set(seed_ids))
    all_dupes = len(all_ids) - len(set(all_ids))

    if seed_dupes == 0:
        ok(f"No duplicate seed IDs ({len(seed_ids)} unique)")
        passed += 1
    else:
        fail(f"{seed_dupes} duplicate seed IDs!")
        failed += 1

    if all_dupes == 0:
        ok(f"No duplicate product IDs ({len(all_ids)} unique)")
        passed += 1
    else:
        fail(f"{all_dupes} duplicate product IDs!")
        failed += 1

    return passed, failed


def test_urls_valid(results: dict) -> tuple[int, int]:
    """Verify URLs are properly formed."""
    section("TEST 7: URL Validity")
    passed = 0
    failed = 0

    products = results["all_products"]

    # Product URLs
    bad_product_urls = [
        p["product_id"] for p in products
        if not p.get("product_url", "").startswith("https://")
    ]
    if not bad_product_urls:
        ok(f"All {len(products)} product URLs start with https://")
        passed += 1
    else:
        fail(f"{len(bad_product_urls)} products have bad URLs: {bad_product_urls[:5]}")
        failed += 1

    # Image URLs
    all_image_urls = [
        url for p in products for url in p.get("image_urls", [])
    ]
    bad_image_urls = [u for u in all_image_urls if not u.startswith("https://")]
    if not bad_image_urls:
        ok(f"All {len(all_image_urls)} image URLs start with https://")
        passed += 1
    else:
        fail(f"{len(bad_image_urls)} bad image URLs found")
        for u in bad_image_urls[:3]:
            print(f"    Bad: {u[:100]}")
        failed += 1

    return passed, failed


def test_failures(results: dict) -> tuple[int, int]:
    """Report on failures."""
    section("TEST 8: Failure Report")
    passed = 0
    failed = 0

    failed_details = results["failed_detail_product_ids"]
    failed_listings = results["failed_listing_pages"]

    if not failed_details:
        ok("No failed detail pages")
        passed += 1
    else:
        warn(f"{len(failed_details)} failed detail pages: {failed_details[:10]}")
        passed += 1  # some failures are expected

    if not failed_listings:
        ok("No failed listing pages")
        passed += 1
    else:
        warn(f"{len(failed_listings)} failed listing pages:")
        for fl in failed_listings[:5]:
            print(f"    {fl['category_name']} page {fl['page']}: {fl['error'][:80]}")
        passed += 1

    return passed, failed


# ── Main ────────────────────────────────────────────────────────────────────

async def run_tests() -> None:
    section("MUSINSA SCRAPER SMOKE TEST")
    print(f"  Products per category: {PRODUCTS_PER_CATEGORY}")
    print(f"  Max listing pages:     {MAX_LISTING_PAGES}")
    print(f"  Headless:              {HEADLESS}")
    print(f"  Concurrency:           {CONCURRENCY}")
    print()

    # Run the scraper with small limits
    start = time.monotonic()
    scraper = MusinsaScraper(
        headless=HEADLESS,
        category_limit=PRODUCTS_PER_CATEGORY,
        max_listing_pages=MAX_LISTING_PAGES,
        max_retries=2,
        concurrency=CONCURRENCY,
        max_scroll_steps=30,         # don't scroll forever for 3 products
        stable_rounds_needed=2,      # faster stabilization for small pages
        verbose=True,
    )

    results = await scraper.run()
    elapsed = time.monotonic() - start

    # ── Run all tests ───────────────────────────────────────────────────
    total_passed = 0
    total_failed = 0

    tests = [
        test_stats,
        test_category_coverage,
        test_seed_product_fields,
        test_detail_product_fields,
        test_variant_discovery,
        test_deduplication,
        test_urls_valid,
        test_failures,
    ]

    for test_fn in tests:
        p, f = test_fn(results)
        total_passed += p
        total_failed += f

    # ── Summary ─────────────────────────────────────────────────────────
    section("FINAL RESULTS")
    print(f"  Total time:   {elapsed:.1f}s")
    print(f"  Tests passed: {GREEN}{total_passed}{RESET}")
    print(f"  Tests failed: {RED if total_failed else GREEN}{total_failed}{RESET}")
    print()

    if total_failed == 0:
        print(f"  {GREEN}{BOLD}🎉 ALL TESTS PASSED — safe to run full scrape!{RESET}")
    else:
        print(f"  {YELLOW}{BOLD}⚠️  {total_failed} test(s) need attention before full scrape{RESET}")

    # ── Dump raw JSON for deep inspection ───────────────────────────────
    dump_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "test_results.json",
    )
    with open(dump_path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n  Raw JSON saved to: {dump_path}")
    print()


if __name__ == "__main__":
    asyncio.run(run_tests())

