from __future__ import annotations

import asyncio
import logging
import os
import random
import re
import time
from dataclasses import dataclass, field, asdict
from typing import Any

from playwright.async_api import (
    BrowserContext,
    Error as PlaywrightError,
    Page,
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

logger = logging.getLogger("musinsa_scraper")


def _setup_logging(verbose: bool) -> None:
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
        )
        logger.addHandler(handler)
    logger.setLevel(logging.DEBUG if verbose else logging.WARNING)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class ProductSeed:
    product_id: str
    brand_id: str | None
    product_name: str | None
    original_price: str | None
    price: str | None
    product_url: str
    source_category_code: str
    source_category_name: str
    source_page: int


@dataclass
class ProductDetail:
    product_id: str
    brand_id: str | None = None
    product_name: str | None = None
    original_price: str | None = None
    price: str | None = None
    product_url: str | None = None
    image_urls: list[str] = field(default_factory=list)
    description_text: str = ""
    variant_product_ids: list[str] = field(default_factory=list)
    source_type: str = "seed"  # "seed" or "variant"
    source_category_code: str | None = None
    source_category_name: str | None = None
    source_page: int | None = None


# ---------------------------------------------------------------------------
# User-agent rotation pool (recent Chrome builds)
# ---------------------------------------------------------------------------

_USER_AGENTS: list[str] = [
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
]


class MusinsaScraper:
    """
    Scrapes:
      1) Top N unique products per category from Musinsa listing pages
      2) Product detail pages for those products (concurrently)
      3) Variant product IDs, and also scrapes unseen variants as separate
         products — with full metadata enrichment

    Handles virtualized / windowed DOMs by extracting products incrementally
    during scrolling rather than after all scrolling is done.

    Returns Python objects only. No local file writes.

    Usage:
        scraper = MusinsaScraper(headless=False)
        results = asyncio.run(scraper.run())

    Results structure:
        {
            "seed_products": [dict, ...],
            "all_products": [dict, ...],   # seed products + discovered variants
            "seed_product_ids": [...],
            "all_product_ids": [...],
            "failed_detail_product_ids": [...],
            "failed_listing_pages": [...],
            "stats": {...}
        }
    """

    BASE_CATEGORY_URL = (
        "https://global.musinsa.com/us/category/{category_code}"
        "?category1DepthCode={category_code}&gender=A&page={page}&sortCode=RECOMMEND"
    )
    BASE_PRODUCT_URL = "https://global.musinsa.com/us/goods/{product_id}"

    # Musinsa category codes → human-readable names
    CATEGORY_MAP: dict[str, str] = {
        "001": "tops",            # T-shirts, shirts, blouses, knits
        "002": "outerwear",       # Jackets, coats, padded
        "003": "pants",           # Jeans, slacks, shorts
        "100": "dresses_skirts",  # Dresses, skirts
        "101": "accessories",     # Hats, jewellery, scarves
        "004": "bags",            # Backpacks, cross-body, totes
        "103": "shoes",           # Sneakers, boots, sandals
    }

    def __init__(
        self,
        *,
        headless: bool = True,
        category_limit: int = 1000,
        max_listing_pages: int = 300,
        navigation_timeout_ms: int = 60_000,
        action_timeout_ms: int = 30_000,
        max_retries: int = 3,
        browser_user_data_dir: str | None = None,
        min_delay_s: float = 0.8,
        max_delay_s: float = 2.2,
        scroll_pause_s: tuple[float, float] = (0.7, 1.3),
        stable_rounds_needed: int = 3,
        max_scroll_steps: int = 250,
        concurrency: int = 5,
        max_consecutive_failures: int = 10,
        verbose: bool = True,
    ) -> None:
        self.headless = headless
        self.category_limit = category_limit
        self.max_listing_pages = max_listing_pages
        self.navigation_timeout_ms = navigation_timeout_ms
        self.action_timeout_ms = action_timeout_ms
        self.max_retries = max_retries
        self.min_delay_s = min_delay_s
        self.max_delay_s = max_delay_s
        self.scroll_pause_s = scroll_pause_s
        self.stable_rounds_needed = stable_rounds_needed
        self.max_scroll_steps = max_scroll_steps
        self.concurrency = concurrency
        self.max_consecutive_failures = max_consecutive_failures
        self.verbose = verbose

        # Default profile dir is next to this script, not CWD
        if browser_user_data_dir is None:
            self.browser_user_data_dir = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "musinsa_playwright_profile",
            )
        else:
            self.browser_user_data_dir = browser_user_data_dir

        _setup_logging(verbose)

        self._pw = None
        self.context: BrowserContext | None = None

        # Concurrency primitives
        self._semaphore = asyncio.Semaphore(concurrency)
        self._state_lock = asyncio.Lock()

        # Circuit breaker
        self._consecutive_failures = 0
        self._circuit_broken = False

        # Global dedupe across listing feed
        self.seen_seed_product_ids: set[str] = set()

        # All detail pages scraped, including variants
        self.seen_detail_product_ids: set[str] = set()

        self.failed_listing_pages: list[dict[str, Any]] = []
        self.failed_detail_product_ids: list[str] = []

        self.seed_products: dict[str, ProductSeed] = {}
        self.all_products: dict[str, ProductDetail] = {}

        # Progress tracking
        self._detail_start_time: float = 0.0
        self._detail_completed: int = 0
        self._listing_start_time: float = 0.0

    # ----------------------------
    # Public API
    # ----------------------------

    async def run(
        self,
        start_category: str | None = None,
        start_page: int | None = None,
        on_batch_ready: Any = None,
    ) -> dict[str, Any]:
        await self._start()

        # C1 — Config dump at startup
        logger.info(
            f"MusinsaScraper config: categories={len(self.CATEGORY_MAP)}, "
            f"limit={self.category_limit}/cat, max_pages={self.max_listing_pages}, "
            f"concurrency={self.concurrency}, max_retries={self.max_retries}, "
            f"max_scroll_steps={self.max_scroll_steps}, "
            f"headless={self.headless}, circuit_breaker={self.max_consecutive_failures}"
        )

        try:
            await self._warmup_context()

            self._listing_start_time = time.monotonic()
            
            categories_to_run = list(self.CATEGORY_MAP.keys())
            if start_category and start_category in categories_to_run:
                idx = categories_to_run.index(start_category)
                categories_to_run = categories_to_run[idx:]

            for i, category_code in enumerate(categories_to_run):
                if self._circuit_broken:
                    logger.error("Global Circuit Breaker triggered. Halting scraper operations.")
                    break
                    
                category_name = self.CATEGORY_MAP[category_code]
                p_start = start_page if (i == 0 and start_page) else 1
                
                logger.info(f"\n=== Category {category_code} ({category_name}) ===")
                await self._scrape_single_category(
                    category_code, 
                    category_name, 
                    start_page=p_start,
                    on_batch_ready=on_batch_ready
                )

            listing_elapsed = time.monotonic() - self._listing_start_time
            logger.info("Scraping completely structurally finished.")

            return {
                "failed_detail_product_ids": self.failed_detail_product_ids,
                "failed_listing_pages": self.failed_listing_pages,
            }
        finally:
            await self._stop()

    # ----------------------------
    # Browser setup / teardown
    # ----------------------------

    async def _start(self) -> None:
        self._pw = await async_playwright().start()
        ua = random.choice(_USER_AGENTS)
        logger.info(f"Launching browser (headless={self.headless}, UA=...{ua[-30:]})")

        self.context = await self._pw.chromium.launch_persistent_context(
            user_data_dir=self.browser_user_data_dir,
            headless=self.headless,
            viewport={"width": 1440, "height": 2200},
            user_agent=ua,
            locale="en-US",
        )
        self.context.set_default_timeout(self.action_timeout_ms)
        self.context.set_default_navigation_timeout(self.navigation_timeout_ms)

        # Set lang cookie for English content (ported from minimal_scraper)
        await self.context.add_cookies([{
            "name": "lang",
            "value": "en",
            "domain": "global.musinsa.com",
            "path": "/",
        }])

    async def _stop(self) -> None:
        try:
            if self.context:
                await self.context.close()
        finally:
            if self._pw:
                await self._pw.stop()

    async def _warmup_context(self) -> None:
        # C7 — Warmup logging
        logger.info("Browser warmup: navigating to homepage...")
        page = await self.context.new_page()
        try:
            await self._goto_with_retries(page, "https://global.musinsa.com/us")
            await self._dismiss_popups(page)
            logger.debug("Browser warmup: popup dismissal pass complete")
            await self._random_delay()
            logger.info("Browser warmup: complete")
        finally:
            await page.close()

    # ----------------------------
    # Popup / overlay dismissal
    # ----------------------------

    async def _dismiss_popups(self, page: Page) -> None:
        """Best-effort close of cookie / region / promo modals."""
        for text in ["Accept", "Agree", "OK", "Close", "Got it", "Dismiss"]:
            try:
                btn = page.locator(f"button:has-text('{text}')").first
                if await btn.count() > 0:
                    await btn.click(timeout=2000)
                    # C5 — DEBUG popup dismissal
                    logger.debug(f"  Dismissed popup: button with text '{text}'")
            except Exception:
                continue

    # ----------------------------
    # Category scraping
    # ----------------------------

    async def _scrape_single_category(
        self, 
        category_code: str, 
        category_name: str, 
        start_page: int = 1,
        on_batch_ready: Any = None
    ) -> None:
        collected_for_category = 0
        page_num = start_page
        consecutive_pages_without_new = 0
        pages_in_batch = 0
        category_start = time.monotonic()

        while (
            collected_for_category < self.category_limit
            and page_num <= self.max_listing_pages
            and not self._circuit_broken
        ):
            logger.info(f"== Navigating Category '{category_code}' -> Listing Page {page_num} ==")
            page = await self.context.new_page()
            url = self._build_category_url(category_code, page_num)

            try:
                await self._goto_with_retries(page, url)
                await self._dismiss_popups(page)
                await self._random_delay()

                await self._wait_for_listing_content(page)

                page_products = await self._scroll_and_extract_listing(
                    page=page,
                    category_code=category_code,
                    category_name=category_name,
                    page_num=page_num,
                )

                new_count = 0
                for product in page_products:
                    if collected_for_category >= self.category_limit:
                        break
                    if product.product_id in self.seen_seed_product_ids:
                        continue

                    self.seen_seed_product_ids.add(product.product_id)
                    self.seed_products[product.product_id] = product
                    collected_for_category += 1
                    new_count += 1

                logger.info(
                    f"Page {page_num}: extracted={len(page_products)} "
                    f"new_unique_added={new_count} category_total={collected_for_category}"
                )

                if new_count == 0:
                    consecutive_pages_without_new += 1
                else:
                    consecutive_pages_without_new = 0

                pages_in_batch += 1
                
                exhausted = consecutive_pages_without_new >= 2
                over_limit = collected_for_category >= self.category_limit

                # Batch Breakpoint Logic
                if pages_in_batch >= 2 or exhausted or over_limit:
                    await self._process_detail_batch(on_batch_ready, category_code, page_num)
                    pages_in_batch = 0

                if exhausted:
                    logger.info(
                        f"Stopping category {category_code}: 2 consecutive pages with no new products."
                    )
                    break

                page_num += 1
                await self._random_delay()

            except (PlaywrightError, PlaywrightTimeoutError, TimeoutError, IOError) as e:
                self.failed_listing_pages.append(
                    {
                        "category_code": category_code,
                        "category_name": category_name,
                        "page": page_num,
                        "url": url,
                        "error": repr(e),
                    }
                )
                logger.error(f"[Listing ERROR] {url} -> {repr(e)}")
                consecutive_pages_without_new += 1
                page_num += 1
            finally:
                await page.close()

        category_elapsed = time.monotonic() - category_start
        cat_failed = len([f for f in self.failed_listing_pages if f["category_code"] == category_code])
        logger.info(
            f"Category {category_code} ({category_name}) complete: "
            f"{collected_for_category} seeds collected across {page_num - start_page} pages "
            f"({cat_failed} failed pages) [{category_elapsed:.1f}s]"
        )

    async def _process_detail_batch(self, on_batch_ready: Any, category_code: str, page_num: int):
        """Halts routing to process variants specifically for un-detailed seeds."""
        pending_seeds = [s for s in self.seed_products.values() if s.product_id not in self.seen_detail_product_ids]
        
        if pending_seeds:
            logger.info(f"Starting detail scraping for batch of {len(pending_seeds)} seeds.")
            tasks = [
                self._scrape_product_and_unseen_variants(
                    product_id=seed.product_id,
                    source_type="seed",
                    seed=seed,
                )
                for seed in pending_seeds
            ]
            await asyncio.gather(*tasks)

        # Trigger pipeline pipeline callback hook natively yielding the loaded variants
        if on_batch_ready and len(self.all_products) > 0:
            batch_data = [asdict(x) for x in self.all_products.values()]
            # Await if it is an async callback or run synchronously
            if asyncio.iscoroutinefunction(on_batch_ready):
                await on_batch_ready(batch_data, category_code, page_num)
            else:
                on_batch_ready(batch_data, category_code, page_num)
                
        # Buffer Purge Phase
        self.all_products.clear()
        self.seed_products.clear()

    # ----------------------------
    # Listing-page scroll + extraction
    # ----------------------------

    async def _wait_for_listing_content(self, page: Page) -> None:
        candidate_selectors = [
            "[data-product-id]",
            "ul li[data-product-id]",
            "li[data-product-id]",
            "main",
        ]
        for sel in candidate_selectors:
            try:
                await page.wait_for_selector(sel, timeout=10_000)
                # C5 — DEBUG selector tracing
                logger.debug(f"  Listing content found via selector: {sel}")
                return
            except PlaywrightTimeoutError:
                continue
        raise TimeoutError("Listing content did not appear after trying all selectors.")

    async def _scroll_and_extract_listing(
        self,
        *,
        page: Page,
        category_code: str,
        category_name: str,
        page_num: int,
    ) -> list[ProductSeed]:
        """
        A1 — Scroll through the listing page, extracting products incrementally
        at each scroll step to handle virtualized DOM recycling.

        Replaces the old _scroll_listing_until_stable + single extraction approach.
        """
        collected: dict[str, ProductSeed] = {}  # pid -> ProductSeed, preserves insertion order
        stable_rounds = 0

        for step in range(self.max_scroll_steps):
            # Extract whatever is currently visible in the DOM
            batch = await self._extract_listing_products(
                page=page,
                category_code=category_code,
                category_name=category_name,
                page_num=page_num,
            )
            new_in_step = 0
            for product in batch:
                if product.product_id not in collected:
                    collected[product.product_id] = product
                    new_in_step += 1

            if new_in_step == 0:
                stable_rounds += 1
            else:
                stable_rounds = 0
                logger.debug(
                    f"  Scroll step {step}: +{new_in_step} new (total {len(collected)})"
                )

            if stable_rounds >= self.stable_rounds_needed:
                logger.debug(
                    f"  Scroll stable after {step + 1} steps, {len(collected)} products collected"
                )
                break

            # A3 — Multi-method scroll
            await self._scroll_page(page)
            # A2 — networkidle wait after scroll
            await self._wait_after_scroll(page)

        # A4 — Final extraction pass after scroll loop
        final_batch = await self._extract_listing_products(
            page=page,
            category_code=category_code,
            category_name=category_name,
            page_num=page_num,
        )
        final_new = 0
        for product in final_batch:
            if product.product_id not in collected:
                collected[product.product_id] = product
                final_new += 1
        if final_new > 0:
            logger.debug(f"  Final extraction pass: +{final_new} new products")

        return list(collected.values())

    async def _scroll_page(self, page: Page) -> None:
        """
        A3 — Use multiple scroll mechanisms to handle both window-scroll
        and container-scroll layouts (ported from minimal_scraper).
        """
        # 1) Keyboard-based scroll (triggers keyboard scroll handlers)
        await page.keyboard.press("PageDown")

        # 2) JS scrollBy targeting the product grid container specifically
        await page.evaluate("""
            () => {
                const grid = document.querySelector(
                    'ul[data-product-list], #globalMain ul, [class*="product-list"]'
                );
                if (grid) grid.scrollBy(0, window.innerHeight * 0.8);
                else window.scrollBy(0, window.innerHeight * 0.8);
            }
        """)

        # 3) Mouse wheel as additional trigger
        await page.mouse.wheel(0, random.randint(800, 1200))

    async def _wait_after_scroll(self, page: Page) -> None:
        """
        A2 — Wait for network activity to settle after scrolling,
        then a small random pause for natural behavior.
        """
        try:
            await page.wait_for_load_state("networkidle", timeout=3000)
        except Exception:
            pass
        await asyncio.sleep(random.uniform(*self.scroll_pause_s))

    async def _extract_listing_products(
        self,
        *,
        page: Page,
        category_code: str,
        category_name: str,
        page_num: int,
    ) -> list[ProductSeed]:
        """
        Prefer stable attributes. Fall back to evaluating nodes with data-* attrs.
        """
        js = """
        () => {
            const nodes = Array.from(document.querySelectorAll('[data-product-id]'));
            const seen = new Set();
            const out = [];

            for (const node of nodes) {
                const productId = node.getAttribute('data-product-id');
                if (!productId || seen.has(productId)) continue;
                seen.add(productId);

                const brandId = node.getAttribute('data-brand-id');
                const productName =
                    node.getAttribute('data-product-name') ||
                    node.getAttribute('data-goods-name') ||
                    node.getAttribute('aria-label') ||
                    null;

                const originalPrice =
                    node.getAttribute('data-original-price') ||
                    node.getAttribute('data-list-price') ||
                    null;

                const price =
                    node.getAttribute('data-price') ||
                    node.getAttribute('data-sale-price') ||
                    null;

                let href = null;
                const link = node.querySelector('a[href*="/goods/"]') || node.closest('a[href*="/goods/"]');
                if (link) href = link.href;

                out.push({
                    product_id: productId,
                    brand_id: brandId,
                    product_name: productName,
                    original_price: originalPrice,
                    price: price,
                    href: href,
                });
            }

            return out;
        }
        """
        raw_items = await page.evaluate(js)
        results: list[ProductSeed] = []

        for item in raw_items:
            product_id = str(item.get("product_id", "")).strip()
            if not product_id:
                continue

            href = item.get("href")
            product_url = href if href else self._build_product_url(product_id)

            results.append(
                ProductSeed(
                    product_id=product_id,
                    brand_id=self._clean_optional(item.get("brand_id")),
                    product_name=self._clean_optional(item.get("product_name")),
                    original_price=self._clean_optional(item.get("original_price")),
                    price=self._clean_optional(item.get("price")),
                    product_url=product_url,
                    source_category_code=category_code,
                    source_category_name=category_name,
                    source_page=page_num,
                )
            )

        return results

    # ----------------------------
    # Detail scraping
    # ----------------------------

    async def _scrape_product_and_unseen_variants(
        self,
        *,
        product_id: str,
        source_type: str,
        seed: ProductSeed | None = None,
    ) -> None:
        """
        Iterative variant traversal with semaphore-bounded concurrency.
        Processes the seed product, discovers variants, and scrapes any
        unseen variants — limited to 1 level deep (seed → variant only,
        no variant-of-variant chaining).
        """
        # queue entries: (pid, source_type, seed, depth)
        # depth=0 = seed product, depth=1 = direct variant
        queue: list[tuple[str, str, ProductSeed | None, int]] = [
            (product_id, source_type, seed, 0)
        ]

        while queue:
            # Check circuit breaker before each item
            if self._circuit_broken:
                logger.warning(f"Circuit breaker active — skipping remaining queue ({len(queue)} items)")
                return

            pid, stype, s, depth = queue.pop(0)

            # Quick dedupe check before acquiring semaphore
            async with self._state_lock:
                if pid in self.seen_detail_product_ids:
                    continue

            async with self._semaphore:
                # Re-check after acquiring semaphore (another task may have scraped it)
                async with self._state_lock:
                    if pid in self.seen_detail_product_ids:
                        continue

                detail = await self._scrape_single_product_detail(
                    product_id=pid,
                    source_type=stype,
                    seed=s,
                )

                async with self._state_lock:
                    if detail is None:
                        self.failed_detail_product_ids.append(pid)
                        self._consecutive_failures += 1
                        if self._consecutive_failures >= self.max_consecutive_failures:
                            logger.error(
                                f"CIRCUIT BREAKER: {self._consecutive_failures} consecutive "
                                f"failures — aborting further detail scraping."
                            )
                            self._circuit_broken = True
                        continue

                    # Success — reset circuit breaker
                    self._consecutive_failures = 0
                    self.seen_detail_product_ids.add(pid)
                    self.all_products[pid] = detail
                    self._detail_completed += 1

                    if self._detail_completed % 50 == 0:
                        self._log_progress()

                # Only queue variants from seed products (depth 0 → 1).
                # Never follow variants-of-variants to prevent infinite chains.
                if depth >= 1:
                    continue

                # C6 — Variant discovery logging
                new_variants = [
                    vid for vid in detail.variant_product_ids
                    if vid != pid and vid not in self.seen_detail_product_ids
                ]
                if new_variants:
                    logger.debug(
                        f"  Product {pid}: queued {len(new_variants)} new variants: "
                        f"{new_variants[:5]}{'...' if len(new_variants) > 5 else ''}"
                    )

                # Queue unseen variants (depth + 1)
                for variant_id in detail.variant_product_ids:
                    if variant_id == pid:
                        continue
                    async with self._state_lock:
                        if variant_id not in self.seen_detail_product_ids:
                            queue.append((variant_id, "variant", None, depth + 1))

    async def _scrape_single_product_detail(
        self,
        *,
        product_id: str,
        source_type: str,
        seed: ProductSeed | None = None,
    ) -> ProductDetail | None:
        page = await self.context.new_page()
        url = self._build_product_url(product_id)

        try:
            await self._goto_with_retries(page, url)
            await self._dismiss_popups(page)
            await self._random_delay()

            await self._wait_for_product_detail_content(page)

            # B1 — Trigger image gallery before extraction
            await self._trigger_image_gallery(page)

            # Guard against accidental navigation off the goods page
            if "/us/goods/" not in page.url:
                logger.warning(
                    f"[Detail] {product_id}: page left goods route after gallery priming -> {page.url}; "
                    f"reloading {url}"
                )
                await self._goto_with_retries(page, url)
                await self._dismiss_popups(page)
                await self._wait_for_product_detail_content(page)

            # DEBUG: Diagnostic JS to verify page state before extraction
            try:
                diag = await page.evaluate("""
                () => {
                    return {
                        url: window.location.href,
                        hasMain: !!document.querySelector('main'),
                        sectionCount: document.querySelectorAll('main section').length,
                        imgCount: document.querySelectorAll('main section:first-of-type img').length,
                        tabCount: document.querySelectorAll('button[role="tab"]').length,
                        descTabExists: !!document.getElementById('DESCRIPTION-tab'),
                    };
                }
                """)
                logger.debug(f"  Page diagnostic: {diag}")
            except Exception as e:
                logger.debug(f"  Page diagnostic FAILED: {e}")

            image_urls = await self._extract_image_urls(page, product_id)
            variant_ids = await self._extract_variant_ids(page)
            description_text = await self._extract_description_text(page)

            # --- Metadata: use seed data or scrape from the detail page ---
            if seed is not None:
                brand_id = seed.brand_id
                product_name = seed.product_name
                original_price = seed.original_price
                price = seed.price
                source_category_code = seed.source_category_code
                source_category_name = seed.source_category_name
                source_page = seed.source_page
            else:
                # Variant product — enrich metadata from the detail page
                meta = await self._extract_product_metadata(page)
                brand_id = meta.get("brand_id")
                product_name = meta.get("product_name")
                original_price = meta.get("original_price")
                price = meta.get("price")
                source_category_code = None
                source_category_name = None
                source_page = None
                # C5 — DEBUG metadata extraction tier
                logger.debug(
                    f"  Variant {product_id} metadata: name={product_name!r}, "
                    f"brand={brand_id!r}, price={price!r}"
                )

            # C4 — Empty data warnings
            if not image_urls:
                logger.warning(f"[Detail] {product_id}: 0 images extracted")
            if not description_text:
                logger.warning(f"[Detail] {product_id}: empty description text")
            if seed is None and not product_name:
                logger.warning(
                    f"[Detail] {product_id}: variant has no product name "
                    f"(metadata extraction failed)"
                )

            detail = ProductDetail(
                product_id=product_id,
                brand_id=brand_id,
                product_name=product_name,
                original_price=original_price,
                price=price,
                product_url=url,
                image_urls=image_urls,
                description_text=description_text,
                variant_product_ids=variant_ids,
                source_type=source_type,
                source_category_code=source_category_code,
                source_category_name=source_category_name,
                source_page=source_page,
            )

            logger.debug(
                f"[Detail] {product_id} ({source_type}) "
                f"images={len(image_urls)} variants={len(variant_ids)} "
                f"desc_len={len(description_text)} name={product_name!r}"
            )
            return detail

        except Exception as e:
            logger.error(f"[Detail ERROR] {product_id} -> {repr(e)}")
            return None
        finally:
            await page.close()

    async def _wait_for_product_detail_content(self, page: Page) -> None:
        """
        Wait for the actual Musinsa goods-page regions we depend on:
        - media gallery
        - right-side product info column
        - tab strip
        This is stricter than waiting for any img/section because the page can
        render partial shells early.
        """
        required_selectors = [
            "xpath=/html/body/div/div/div[2]/main/section[1]/div[1]/div/div[2]",
            "xpath=/html/body/div/div/div[2]/main/section[1]/div[2]",
            "xpath=/html/body/div/div/div[2]/main/section[2]/ul",
        ]
        for sel in required_selectors:
            try:
                await page.wait_for_selector(sel, timeout=15_000)
                logger.debug(f"  Detail content found via selector: {sel}")
            except PlaywrightTimeoutError:
                raise TimeoutError(f"Product detail selector did not appear: {sel}")

        # Give the SPA a moment to finish hydration after all required regions exist.
        await asyncio.sleep(1.2)

    async def _trigger_image_gallery(self, page: Page) -> None:
        """
        Prime the gallery without clicking.

        Important: clicking inside the media rail can navigate away from the
        goods page to /recommend/similar?... on Musinsa. We therefore only
        scroll / wait here and never click or hover thumbnails.
        """
        try:
            original_url = page.url
            gallery = page.locator(
                "xpath=/html/body/div/div/div[2]/main/section[1]/div[1]/div/div[2]"
            )
            if await gallery.count() == 0:
                logger.debug("  Gallery priming skipped: gallery container not found")
                return

            target = gallery.first
            await target.scroll_into_view_if_needed()
            await asyncio.sleep(0.35)

            for delta in (180, 260, -140, 120):
                try:
                    await page.mouse.wheel(0, delta)
                    await asyncio.sleep(0.15)
                except Exception:
                    pass

            if "/us/goods/" not in page.url and original_url:
                logger.warning(f"  Gallery priming left goods page: {page.url} -> reloading {original_url}")
                await self._goto_with_retries(page, original_url)
                await self._dismiss_popups(page)
                await self._wait_for_product_detail_content(page)

            logger.debug("  Gallery primed with non-click strategy")
        except Exception as e:
            logger.debug(f"  Gallery priming failed (non-fatal): {e}")

    async def _extract_product_metadata(self, page: Page) -> dict[str, str | None]:
        """
        Scrape product name, brand, and price from a detail page.
        Used for variant products that don't have seed data.
        Tries structured LD+JSON first, then OG tags, then DOM selectors.
        """
        js = """
        () => {
            const result = {
                product_name: null,
                brand_id: null,
                original_price: null,
                price: null,
                _source: 'none',
            };

            // 1) Try LD+JSON structured data
            const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const s of ldScripts) {
                try {
                    const data = JSON.parse(s.textContent);
                    if (data['@type'] === 'Product' || data.name) {
                        result.product_name = result.product_name || data.name || null;
                        if (data.brand) {
                            result.brand_id = result.brand_id || data.brand.name || data.brand || null;
                        }
                        if (data.offers) {
                            const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
                            result.price = result.price || offer.price?.toString() || null;
                            result.original_price = result.original_price || offer.highPrice?.toString() || null;
                        }
                        if (result.product_name) result._source = 'ld+json';
                    }
                } catch (e) { /* ignore parse errors */ }
            }

            // 2) OG tags fallback — strip "MUSINSA | " prefix from og:title
            if (!result.product_name) {
                const ogTitle = document.querySelector('meta[property="og:title"]');
                if (ogTitle && ogTitle.content) {
                    let title = ogTitle.content;
                    // og:title format is "MUSINSA | Brand Product Name"
                    const pipeIdx = title.indexOf('|');
                    if (pipeIdx !== -1) {
                        title = title.substring(pipeIdx + 1).trim();
                    }
                    result.product_name = title || null;
                    if (result.product_name) result._source = 'og:title';
                }
            }

            // 3) DOM selector fallbacks
            if (!result.product_name) {
                const h1 = document.querySelector('h1, [data-product-name], [data-goods-name]');
                if (h1) {
                    result.product_name = h1.textContent?.trim() || null;
                    if (result.product_name) result._source = 'dom';
                }
            }

            if (!result.brand_id) {
                const brandEl = document.querySelector('[data-brand-id], [data-brand-name], a[href*="/brand/"]');
                if (brandEl) {
                    result.brand_id = brandEl.getAttribute('data-brand-id')
                        || brandEl.getAttribute('data-brand-name')
                        || brandEl.textContent?.trim()
                        || null;
                }
            }

            return result;
        }
        """
        result = await page.evaluate(js)
        # C5 — DEBUG which metadata tier succeeded
        source = result.pop("_source", "none")
        logger.debug(f"  Metadata extraction source: {source}")
        return result

    async def _extract_image_urls(self, page: Page, product_id: str) -> list[str]:
        """
        Extract only this product's gallery images from the exact media-gallery subtree.
        Keep the highest-quality version of each underlying image and exclude
        recommendation-strip images from other product IDs.
        """
        js = r"""
        () => {
            const normalize = (u) => {
                if (!u || typeof u !== 'string') return null;
                let s = u.trim();
                if (!s) return null;
                if (s.startsWith('//')) s = 'https:' + s;
                if (!/^https?:\/\//i.test(s)) return null;
                return s;
            };

            const gallery = document.evaluate(
                '/html/body/div/div/div[2]/main/section[1]/div[1]/div/div[2]',
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue;

            if (!gallery) return [];

            const urls = [];
            const imgs = Array.from(gallery.querySelectorAll('img'));

            for (const img of imgs) {
                const candidates = [
                    img.currentSrc,
                    img.getAttribute('src'),
                    img.getAttribute('data-src'),
                    img.getAttribute('data-lazy-src'),
                    img.getAttribute('data-original'),
                    img.getAttribute('data-zoom-image'),
                ].filter(Boolean);

                for (const cand of candidates) {
                    const resolved = normalize(cand);
                    if (resolved) urls.push(resolved);
                }

                const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
                if (srcset) {
                    for (const part of srcset.split(',')) {
                        const piece = part.trim().split(/\s+/)[0];
                        const resolved = normalize(piece);
                        if (resolved) urls.push(resolved);
                    }
                }
            }

            return urls;
        }
        """
        raw_urls = await page.evaluate(js)
        cleaned = self._select_best_gallery_urls(raw_urls, product_id)
        logger.debug(f"  Images: extracted {len(cleaned)} gallery URLs")
        return cleaned

    async def _extract_variant_ids(self, page: Page) -> list[str]:
        """
        Collect variant product IDs from the product info column.

        Primary strategy:
        - exact inspected variant container:
          /html/body/div/div/div[2]/main/section[1]/div[2]/div[2]
        Fallback:
        - scan the full right-side info column for /goods/ links
        Excludes the current product id and dedupes results.
        """
        current_product_id = self._extract_product_id_from_url(page.url or "") or ""
        raw_ids: list[str] = []
        extraction_source = "none"

        # Primary: exact user-inspected variant area
        try:
            locator = page.locator(
                "xpath=/html/body/div/div/div[2]/main/section[1]/div[2]/div[2]//a[contains(@href, '/goods/')]"
            )
            count = await locator.count()
            ids: list[str] = []
            for i in range(count):
                href = await locator.nth(i).get_attribute("href")
                pid = self._extract_product_id_from_url(href or "")
                if pid and pid != current_product_id:
                    ids.append(pid)
            if ids:
                raw_ids = ids
                extraction_source = "exact_variant_container"
        except Exception:
            pass

        # Fallback 1: scan right-side product info column only
        if not raw_ids:
            try:
                info_col = page.locator(
                    "xpath=/html/body/div/div/div[2]/main/section[1]/div[2]"
                )
                anchors = info_col.locator('a[href*="/goods/"]')
                count = await anchors.count()
                ids: list[str] = []
                for i in range(count):
                    href = await anchors.nth(i).get_attribute("href")
                    pid = self._extract_product_id_from_url(href or "")
                    if pid and pid != current_product_id:
                        ids.append(pid)
                if ids:
                    raw_ids = ids
                    extraction_source = "info_column_fallback"
            except Exception:
                pass

        # Fallback 2: text-guided JS search within first section only
        if not raw_ids:
            try:
                js = r"""
                () => {
                    const current = (window.location.pathname.match(/\/goods\/(\d+)/) || [])[1] || '';
                    const ids = new Set();
                    const firstSection = document.querySelector('main section:first-of-type');
                    if (!firstSection) return [];

                    const textHints = ['color', 'option', 'variant', 'size'];
                    const candidates = Array.from(firstSection.querySelectorAll('a[href*="/goods/"]'));

                    for (const a of candidates) {
                        const href = a.href || a.getAttribute('href') || '';
                        const m = href.match(/\/goods\/(\d+)/);
                        if (!m || m[1] === current) continue;

                        const container = a.closest('li, div, ul, section');
                        const context = (container?.innerText || '').toLowerCase();
                        if (textHints.some(h => context.includes(h))) {
                            ids.add(m[1]);
                        }
                    }

                    return Array.from(ids);
                }
                """
                ids = await page.evaluate(js)
                if ids:
                    raw_ids = [str(x) for x in ids]
                    extraction_source = "js_context_fallback"
            except Exception:
                pass

        cleaned = self._dedupe_preserve_order([str(x) for x in raw_ids if str(x).isdigit()])
        logger.debug(f"  Variants: {len(cleaned)} from {extraction_source}")
        return cleaned

    async def _extract_description_text(self, page: Page) -> str:
        """
        Click the DESCRIPTION tab and extract raw text from its actual tab panel.
        Prefer ARIA tab -> panel linkage over brittle section indexes.
        """
        clicked = False
        click_source = None
        panel_text = ""

        # Strategy 1: reliable Playwright tab lookup
        tab_selectors = [
            'button[id="DESCRIPTION-tab"]',
            'button[role="tab"][id*="DESCRIPTION"]',
            'button[role="tab"]:has-text("DESCRIPTION")',
            'button[role="tab"]:has-text("Description")',
        ]

        tab = None
        for sel in tab_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.count() > 0:
                    tab = loc
                    click_source = sel
                    break
            except Exception:
                continue

        # Strategy 2: JS discovery by text if selector lookup missed
        if tab is None:
            try:
                js = """
                () => {
                    const tabs = Array.from(document.querySelectorAll('button[role="tab"], button'));
                    for (const t of tabs) {
                        const text = (t.textContent || '').trim().toUpperCase();
                        if (text === 'DESCRIPTION' || text.includes('DESCRIPTION')) {
                            return t.id || '__FOUND_NO_ID__';
                        }
                    }
                    return null;
                }
                """
                tab_id = await page.evaluate(js)
                if tab_id:
                    if tab_id == "__FOUND_NO_ID__":
                        loc = page.locator('button[role="tab"]:has-text("DESCRIPTION"), button:has-text("DESCRIPTION")').first
                    else:
                        loc = page.locator(f'#{tab_id}')
                    if await loc.count() > 0:
                        tab = loc
                        click_source = f"js:{tab_id}"
            except Exception:
                pass

        if tab is not None:
            try:
                await tab.scroll_into_view_if_needed()
            except Exception:
                pass
            try:
                await tab.click(timeout=5000, force=True)
                clicked = True
            except Exception:
                try:
                    await tab.evaluate("(el) => el.click()")
                    clicked = True
                    click_source = f"{click_source}|dom_click"
                except Exception:
                    pass

        if clicked:
            try:
                await asyncio.sleep(random.uniform(0.8, 1.3))
                await page.wait_for_load_state("networkidle", timeout=3000)
            except Exception:
                pass

        # Primary extraction: follow aria-controls to the real panel
        if tab is not None:
            try:
                controls = await tab.get_attribute("aria-controls")
                if controls:
                    panel = page.locator(f'#{controls}')
                    if await panel.count() > 0:
                        try:
                            await panel.first.wait_for(state="visible", timeout=5000)
                        except Exception:
                            pass
                        panel_text = await panel.first.inner_text()
            except Exception:
                pass

        # Fallback 1: role=tabpanel in section[3]
        if not panel_text:
            try:
                loc = page.locator(
                    "xpath=/html/body/div/div/div[2]/main/section[3]//*[@role='tabpanel']"
                ).first
                if await loc.count() > 0:
                    panel_text = await loc.inner_text()
            except Exception:
                pass

        # Fallback 2: inspected section[3]
        if not panel_text:
            try:
                section = page.locator("xpath=/html/body/div/div/div[2]/main/section[3]").first
                if await section.count() > 0:
                    panel_text = await section.inner_text()
            except Exception:
                pass

        # Fallback 3: scoped dl blocks inside inspected section
        if not panel_text:
            try:
                blocks = page.locator(
                    "xpath=/html/body/div/div/div[2]/main/section[3]/div/div/div/dl/div"
                )
                parts = []
                count = await blocks.count()
                for i in range(count):
                    txt = self._normalize_whitespace(await blocks.nth(i).inner_text())
                    if txt:
                        parts.append(txt)
                if parts:
                    panel_text = "\n".join(parts)
            except Exception:
                pass

        text = self._normalize_whitespace(panel_text)
        logger.debug(
            f"  Description tab: clicked={clicked}"
            + (f" via {click_source}" if click_source else "")
            + f", len={len(text)}"
        )
        return text

    async def _goto_with_retries(self, page: Page, url: str) -> None:
        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=self.navigation_timeout_ms)
                await asyncio.sleep(random.uniform(0.7, 1.4))
                return
            except (PlaywrightTimeoutError, PlaywrightError) as e:
                last_error = e
                logger.warning(f"[Retry {attempt}/{self.max_retries}] goto failed: {url} -> {repr(e)}")
                await asyncio.sleep(random.uniform(1.2, 2.6))

        raise last_error if last_error else RuntimeError(f"Navigation failed: {url}")

    # ----------------------------
    # Progress tracking
    # ----------------------------

    def _log_progress(self) -> None:
        elapsed = time.monotonic() - self._detail_start_time
        rate = self._detail_completed / max(elapsed, 0.001)
        total_seed = len(self.seed_products)
        remaining = total_seed - self._detail_completed
        eta_s = remaining / max(rate, 0.001)

        eta_min = int(eta_s // 60)
        eta_sec = int(eta_s % 60)
        logger.info(
            f"[Progress] {self._detail_completed}/{total_seed} seed products scraped "
            f"({len(self.all_products)} total incl. variants) | "
            f"{rate:.1f} products/s | ETA: {eta_min}m {eta_sec}s | "
            f"failures: {len(self.failed_detail_product_ids)}"
        )

    # ----------------------------
    # Helpers
    # ----------------------------

    def _build_category_url(self, category_code: str, page: int) -> str:
        return self.BASE_CATEGORY_URL.format(category_code=category_code, page=page)

    def _build_product_url(self, product_id: str) -> str:
        return self.BASE_PRODUCT_URL.format(product_id=product_id)

    async def _random_delay(self) -> None:
        await asyncio.sleep(random.uniform(self.min_delay_s, self.max_delay_s))

    @staticmethod
    def _normalize_image_url(url: str) -> str:
        """Strip whitespace and ensure protocol prefix."""
        url = url.strip()
        if url.startswith("//"):
            url = "https:" + url
        return url

    @staticmethod
    def _image_candidate_score(url: str) -> int:
        """
        Higher score = better candidate. Prefer explicit larger width params and
        detail/goods big-image paths.
        """
        from urllib.parse import urlparse, parse_qs

        try:
            parsed = urlparse(url)
            qs = parse_qs(parsed.query)
            width = 0
            if "w" in qs:
                try:
                    width = max(int(x) for x in qs["w"] if str(x).isdigit())
                except Exception:
                    width = 0

            score = width
            path = parsed.path.lower()
            if "detail_" in path:
                score += 5000
            if "_big." in path:
                score += 2000
            if "/prd_img/" in path:
                score += 1000
            if "/goods_img/" in path:
                score += 800
            return score
        except Exception:
            return 0

    @staticmethod
    def _image_base_key(url: str) -> str:
        """Canonical dedupe key for the same image across querystring sizes."""
        from urllib.parse import urlparse, urlunparse

        try:
            parsed = urlparse(url)
            return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
        except Exception:
            return url

    def _select_best_gallery_urls(self, urls: list[str], product_id: str) -> list[str]:
        """
        Keep only this product's image URLs and select the highest-quality version
        of each underlying image path.
        """
        best_by_key: dict[str, str] = {}

        for raw in urls:
            url = self._normalize_image_url(raw)
            if not url:
                continue

            # Filter out recommendation-strip or unrelated product images.
            if f"/{product_id}/" not in url and f"{product_id}_" not in url:
                continue

            key = self._image_base_key(url)
            prev = best_by_key.get(key)
            if prev is None or self._image_candidate_score(url) > self._image_candidate_score(prev):
                best_by_key[key] = url

        ordered: list[str] = []
        seen_keys: set[str] = set()
        for raw in urls:
            url = self._normalize_image_url(raw)
            key = self._image_base_key(url)
            if key in best_by_key and key not in seen_keys:
                ordered.append(best_by_key[key])
                seen_keys.add(key)

        return ordered

    @staticmethod
    def _normalize_whitespace(text: str) -> str:
        return re.sub(r"\s+", " ", text or "").strip()

    @staticmethod
    def _clean_optional(value: Any) -> str | None:
        if value is None:
            return None
        s = str(value).strip()
        return s if s else None

    @staticmethod
    def _dedupe_preserve_order(items: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for item in items:
            if item in seen:
                continue
            seen.add(item)
            out.append(item)
        return out

    @staticmethod
    def _extract_product_id_from_url(url: str) -> str | None:
        m = re.search(r"/goods/(\d+)", url)
        if m:
            return m.group(1)
        return None


# ----------------------------
# Example run
# ----------------------------

async def main() -> None:
    scraper = MusinsaScraper(
        headless=False,          # set True in production
        category_limit=1000,     # 1000 per category
        max_listing_pages=300,
        max_retries=3,
        concurrency=5,
        verbose=True,
    )

    results = await scraper.run()

    print("\n=== FINAL STATS ===")
    print(results["stats"])
    print(f"Seed products: {len(results['seed_products'])}")
    print(f"All products: {len(results['all_products'])}")
    print(f"Failed detail pages: {len(results['failed_detail_product_ids'])}")
    print(f"Failed listing pages: {len(results['failed_listing_pages'])}")

    # Example: inspect one product object
    if results["all_products"]:
        print("\n=== SAMPLE PRODUCT ===")
        print(results["all_products"][0])


if __name__ == "__main__":
    asyncio.run(main())