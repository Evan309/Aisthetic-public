import React, { useMemo, useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Share2, Star, ChevronDown, Bookmark, ChevronUp } from "lucide-react";
import type { Product } from "../types";
import { apiClient, type ApiProduct } from "../utils/api";

import ProductCard from "../components/ProductCard";
import SaveToClosetModal from "../components/SaveToClosetModal";
import { useStartSimilarProducts, useCachedSearch } from "../hooks/search";

type VendorLink = {
  label: string;
  url: string;
};

function extractVendorLinks(data: any): VendorLink[] {
  const links: VendorLink[] = [];

  if (Array.isArray(data?.purchase_links)) {
    for (const x of data.purchase_links) {
      if (x?.url) links.push({ label: x?.label || "Buy", url: String(x.url) });
    }
  }

  if (Array.isArray(data?.vendor_links)) {
    for (const x of data.vendor_links) {
      if (x?.url) links.push({ label: x?.retailer_name || x?.name || "Buy", url: String(x.url) });
    }
  }

  if (Array.isArray(data?.offer_links)) {
    for (const x of data.offer_links) {
      if (x?.url) links.push({ label: x?.retailer || "Buy", url: String(x.url) });
    }
  }

  if (data?.url && typeof data.url === "string") {
    const retailerName = data?.retailer_name || data?.retailer?.name || data?.retailer || "Retailer";
    links.push({ label: retailerName, url: data.url });
  }

  const seen = new Set<string>();
  return links.filter((l) => {
    const key = l.url.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const ACCENT = "#213A53";
const ACCENT_DARK = "#112233";

const ProductDetailPage: React.FC = () => {
  const { productid } = useParams<{ productid: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [apiProduct, setApiProduct] = useState<ApiProduct | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  const [selectedImage, setSelectedImage] = useState(0);
  const [galleryPage, setGalleryPage] = useState(0);
  const [galleryTransitionStage, setGalleryTransitionStage] = useState<"idle" | "out" | "in">("idle");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Save-to-closet modal
  const [saveOpen, setSaveOpen] = useState(false);

  // ============================================================
  // "More like this" (product-level recommendations)
  // ============================================================

  const qc = useQueryClient();

  const [recoSearchId, setRecoSearchId] = useState<string | null>(null);

  // How many backend pages we are willing to display (1 page, 2 pages, ...)
  const [recoVisiblePages, setRecoVisiblePages] = useState<number>(1);

  // Before showing the full first backend page, show only 1 grid row
  const [recoShowFirstRowOnly, setRecoShowFirstRowOnly] = useState<boolean>(true);

  // Track current column count so "first row" means 2/3/5 items depending on breakpoint
  const [recoCols, setRecoCols] = useState<number>(() => {
    if (typeof window === "undefined") return 5;
    const w = window.innerWidth;
    if (w >= 1024) return 5;
    if (w >= 640) return 3;
    return 2;
  });

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setRecoCols(w >= 1024 ? 5 : w >= 640 ? 3 : 2);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);


  // guards against duplicate start calls (StrictMode / rerenders)
  const inflightRef = useRef(false);
  const lastKeyRef = useRef<string | null>(null);

  const startSimilar = useStartSimilarProducts();
  const recoInfinite = useCachedSearch(recoSearchId);

  // Fetch product data from API
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productid) return;

      setLoading(true);
      setError(null);

      try {
        const productId = parseInt(productid, 10);
        if (isNaN(productId)) throw new Error("Invalid product ID");

        const data: ApiProduct = await apiClient.getProduct(productId);
        setApiProduct(data);

        const converted: Product = {
          id: data.id,
          productId: data.id,
          name: data.name || "",
          price: data.price,
          originalPrice: data.originalPrice,
          image: data.image,
          images: data.images_list || (data.image ? [data.image] : []),
          description: data.description,
          category: data.category_name || data.category,
          brand: data.brand_name || data.brand,
          inStock: data.inStock,
          rating: data.rating,
          reviewCount: data.reviewCount,
          tags: data.tags,
        };

        setProduct(converted);

        const variants = data.variants || [];
        const sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[];
        const colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[];

        const requestedVariantIdRaw = searchParams.get("variantId");
        const requestedVariantId = requestedVariantIdRaw ? Number(requestedVariantIdRaw) : null;
        const requestedVariant = requestedVariantId
          ? variants.find((v) => v.id === requestedVariantId) || null
          : null;

        if (requestedVariant) {
          setSelectedVariantId(requestedVariant.id);
          if (requestedVariant.size) setSelectedSize(requestedVariant.size);
          if (requestedVariant.color) setSelectedColor(requestedVariant.color);
        } else {
          if (!selectedSize && sizes.length > 0) setSelectedSize(sizes[0]);
          if (!selectedColor && colors.length > 0) setSelectedColor(colors[0]);
          if (variants.length > 0) setSelectedVariantId(variants[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch product");
        console.error("Failed to fetch product:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productid, searchParams]);

  useEffect(() => {
    setRecoVisiblePages(1);
    setRecoShowFirstRowOnly(true);
  }, [product?.id]);


  // Start (or restore) "More like this" recommendations when product changes
  useEffect(() => {
    if (!product) return;

    const cacheKey = `p:${product.id}|mode:similar|ps:cached`;

    const cachedSid = qc.getQueryData<string>(["productRecoSession", cacheKey]);
    if (cachedSid) {
      lastKeyRef.current = cacheKey;
      setRecoSearchId(cachedSid);
      return;
    }

    if (lastKeyRef.current === cacheKey && recoSearchId) return;
    if (inflightRef.current) return;

    inflightRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const firstPage = await startSimilar.mutateAsync({
          productId: product.id,
          variantId: selectedVariantId,
          cacheKey,
        });

        if (!cancelled) {
          lastKeyRef.current = cacheKey;
          setRecoSearchId(firstPage.search_id);
        }
      } finally {
        inflightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, selectedVariantId, qc]);

  const recoHasSession = !!recoSearchId;

  const recoLoading =
    startSimilar.isPending || (recoHasSession && recoInfinite.isLoading && !recoInfinite.data);

  const recoError = startSimilar.isError || recoInfinite.isError;

  const recommendedProducts =
    recoInfinite.data?.pages.flatMap((p: any) => p.products ?? p.results ?? []) ?? [];

  // Infer backend page size from first page (fallback 20)
  const firstPage = recoInfinite.data?.pages?.[0];
  const inferredPageSize = firstPage?.products?.length || 20;


  const fullPagesVisibleCount = recoVisiblePages * inferredPageSize;

  // If we're in "first row only" mode, show only 1 row worth of items
  const visibleRecoCount = recoShowFirstRowOnly
    ? Math.min(recoCols, recommendedProducts.length)
    : Math.min(fullPagesVisibleCount, recommendedProducts.length);

  const visibleReco = recommendedProducts.slice(0, visibleRecoCount);

  const hasMoreLoaded = recommendedProducts.length > visibleRecoCount;
  const canLoadMore = hasMoreLoaded || !!recoInfinite.hasNextPage;

  const onLoadMoreReco = async () => {
    // Step 1: If we're only showing the first row, expand to the FULL first backend page
    if (recoShowFirstRowOnly) {
      setRecoShowFirstRowOnly(false);

      // If we don't yet have enough items loaded to fill the first backend page, fetch once
      if (recommendedProducts.length < inferredPageSize && recoInfinite.hasNextPage && !recoInfinite.isFetchingNextPage) {
        await recoInfinite.fetchNextPage();
      }
      return;
    }

    // Step 2: We are already showing full pages.
    // If next page worth is already loaded locally, just reveal it.
    const nextVisible = (recoVisiblePages + 1) * inferredPageSize;
    if (recommendedProducts.length >= nextVisible) {
      setRecoVisiblePages((p) => p + 1);
      return;
    }

    // Otherwise fetch next backend page, then reveal it.
    if (recoInfinite.hasNextPage && !recoInfinite.isFetchingNextPage) {
      await recoInfinite.fetchNextPage();
      setRecoVisiblePages((p) => p + 1);
    }
  };

  // ============================================================
  // Variant-driven UI (sizes / colors / selected variant)
  // ============================================================

  const variants = apiProduct?.variants || [];

  const availableSizes = useMemo(() => {
    const vals = variants.map((v) => v.size).filter(Boolean) as string[];
    return Array.from(new Set(vals));
  }, [variants]);

  const colorOptions = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const v of variants) {
      const c = (v.color || "").trim();
      if (!c) continue;

      const img = v.image_url || null;
      if (!map.has(c)) map.set(c, img);
      if (!map.get(c) && img) map.set(c, img);
    }
    return Array.from(map.entries()).map(([color, image_url]) => ({ color, image_url }));
  }, [variants]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) || null,
    [variants, selectedVariantId]
  );

  const variantHeroById = useMemo(() => {
    const map = new Map<number, string>();
    for (const variant of variants) {
      if (variant.image_url) {
        map.set(variant.id, variant.image_url);
      }
    }
    const imageRows = apiProduct?.images || [];
    for (const img of imageRows) {
      if (img.variant_id == null || !img.url) continue;
      if (!map.has(img.variant_id)) {
        map.set(img.variant_id, img.url);
      }
    }
    return map;
  }, [variants, apiProduct?.images]);

  // Keep size/color selectors and explicit variant selection in sync.
  useEffect(() => {
    if (!selectedVariantId) return;
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;
    if (variant.size && variant.size !== selectedSize) setSelectedSize(variant.size);
    if (variant.color && variant.color !== selectedColor) setSelectedColor(variant.color);
  }, [selectedVariantId, variants, selectedSize, selectedColor]);

  useEffect(() => {
    if (!variants.length) return;
    // Do not auto-pick from empty selectors; it can override explicit variant clicks
    // for products whose variants don't carry color/size metadata.
    if (!selectedSize && !selectedColor) return;
    const exact = variants.find(
      (v) =>
        (selectedSize ? v.size === selectedSize : true) &&
        (selectedColor ? v.color === selectedColor : true)
    );
    if (exact?.id && exact.id !== selectedVariantId) {
      setSelectedVariantId(exact.id);
      return;
    }

    const byColor = variants.find((v) => (selectedColor ? v.color === selectedColor : false));
    if (byColor?.id && byColor.id !== selectedVariantId) {
      setSelectedVariantId(byColor.id);
      return;
    }

    const bySize = variants.find((v) => (selectedSize ? v.size === selectedSize : false));
    if (bySize?.id && bySize.id !== selectedVariantId) {
      setSelectedVariantId(bySize.id);
    }
  }, [variants, selectedSize, selectedColor, selectedVariantId]);

  const galleryImages = useMemo(() => {
    if (!selectedVariantId) return [];

    const imageRows = apiProduct?.images || [];

    const variantOnly = imageRows
      .filter((img) => img.variant_id === selectedVariantId)
      .map((img) => img.url)
      .filter(Boolean);

    if (variantOnly.length > 0) return variantOnly;

    const variantFallback = selectedVariant?.image_url ? [selectedVariant.image_url] : [];
    return variantFallback.length > 0 ? variantFallback : [];
  }, [apiProduct?.images, selectedVariantId, selectedVariant]);

  useEffect(() => {
    setSelectedImage(0);
    setGalleryPage(0);
  }, [selectedVariantId]);

  const vendorLinks = useMemo(() => extractVendorLinks(apiProduct as any), [apiProduct]);
  const THUMBS_PER_PAGE = 6;
  const galleryPageCount = Math.max(1, Math.ceil(galleryImages.length / THUMBS_PER_PAGE));
  const visibleThumbs = galleryImages.slice(
    galleryPage * THUMBS_PER_PAGE,
    (galleryPage + 1) * THUMBS_PER_PAGE
  );

  useEffect(() => {
    if (galleryPage > galleryPageCount - 1) {
      setGalleryPage(Math.max(0, galleryPageCount - 1));
    }
  }, [galleryPage, galleryPageCount]);

  const goToGalleryPage = (nextPage: number) => {
    const clamped = Math.max(0, Math.min(galleryPageCount - 1, nextPage));
    if (clamped === galleryPage) return;

    setGalleryTransitionStage("out");
    window.setTimeout(() => {
      setGalleryPage(clamped);
      setGalleryTransitionStage("in");
      window.setTimeout(() => setGalleryTransitionStage("idle"), 180);
    }, 140);
  };

  // ============================================================
  // UI
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: ACCENT }}
          />
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">{error || "Product not found"}</p>
          <button
            onClick={() => navigate("/products")}
            className="font-medium transition-colors"
            style={{ color: ACCENT }}
            onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.color = ACCENT)}
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Home padding + cap width at a typical desktop viewport so ultra-wide screens don’t over-stretch */}
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Top row */}
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm text-gray-700 hover:underline" aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 transition"
              aria-label="Share"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <nav className="mb-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Link
              to="/"
              className="transition-colors text-gray-600"
              onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#4B5563")}
            >
              Home
            </Link>
            <span>/</span>
            <Link
              to="/products"
              className="transition-colors text-gray-600"
              onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#4B5563")}
            >
              Products
            </Link>
            <span>/</span>
            <span className="text-gray-900 truncate">{product.name}</span>
          </div>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Images */}
          <div className="flex items-start gap-3">
            {galleryImages.length > 0 && (
              <div className="flex-shrink-0 h-[64vh] min-h-[520px] max-h-[920px] lg:h-[82vh] w-20 grid grid-rows-[1fr,auto] gap-2 overflow-hidden">
                <div
                  className={`min-h-0 overflow-hidden grid grid-rows-6 gap-2 transition-all duration-200 ${
                    galleryTransitionStage === "out"
                      ? "opacity-0 translate-y-1"
                      : "opacity-100 translate-y-0"
                  }`}
                >
                  {visibleThumbs.map(
                  (image, index) =>
                    image && (
                      <button
                        key={galleryPage * THUMBS_PER_PAGE + index}
                        onClick={() => setSelectedImage(galleryPage * THUMBS_PER_PAGE + index)}
                        className={`w-20 h-full overflow-hidden border-2 rounded-lg transition-colors ${selectedImage === galleryPage * THUMBS_PER_PAGE + index ? "" : "border-gray-200 hover:border-gray-300"
                          }`}
                        style={selectedImage === galleryPage * THUMBS_PER_PAGE + index ? { borderColor: ACCENT } : {}}
                        aria-label={`Select image ${galleryPage * THUMBS_PER_PAGE + index + 1}`}
                      >
                        <img src={image} alt={`${product.name} ${galleryPage * THUMBS_PER_PAGE + index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    )
                )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => goToGalleryPage(galleryPage - 1)}
                    disabled={galleryPage === 0}
                    className="h-9 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
                    aria-label="Previous image page"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToGalleryPage(galleryPage + 1)}
                    disabled={galleryPage >= galleryPageCount - 1}
                    className="h-9 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
                    aria-label="Next image page"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 bg-white overflow-hidden shadow-sm border border-gray-200 rounded-xl h-[64vh] min-h-[520px] max-h-[920px] lg:h-[82vh]">
              <img
                src={galleryImages[selectedImage] || galleryImages[0] || "/placeholder-image.png"}
                alt={product.name}
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>

          {/* Info */}
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold mb-1">{product.name}</h1>

              <div className="flex items-center gap-3 mb-2">
                {product.rating != null && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="font-medium text-sm">{product.rating}</span>
                    {product.reviewCount != null && <span className="text-gray-600 text-sm">({product.reviewCount})</span>}
                  </div>
                )}
                {product.brand && <span className="text-sm text-gray-600">{product.brand}</span>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold" style={{ color: ACCENT }}>
                {product.price != null ? `$${product.price.toFixed(2)}` : "N/A"}
              </span>
              {product.originalPrice && product.price && product.originalPrice > product.price && (
                <>
                  <span className="text-lg text-gray-500 line-through">${product.originalPrice.toFixed(2)}</span>
                  <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-medium">
                    {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                  </span>
                </>
              )}
            </div>

            {product.description ? <p className="text-gray-700 text-sm leading-relaxed">{product.description}</p> : null}

            {/* Size dropdown */}
            <div>
              <h3 className="text-base font-semibold mb-2">Size</h3>
              {availableSizes.length === 0 ? (
                <div className="text-sm text-gray-500">No size info.</div>
              ) : (
                <div className="max-w-xs">
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 transition"
                    style={{ "--tw-ring-color": ACCENT } as React.CSSProperties}
                  >
                    {availableSizes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Color previews */}
            <div>
              <h3 className="text-base font-semibold mb-2">Color</h3>
              {colorOptions.length === 0 ? (
                <div className="text-sm text-gray-500">No color info.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(({ color, image_url }) => {
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`rounded-xl border transition overflow-hidden ${isSelected ? "" : "border-gray-300 hover:border-gray-400"
                          }`}
                        style={isSelected ? { borderColor: ACCENT, boxShadow: "0 0 0 2px rgba(106, 30, 30, 0.15)" } : undefined}
                        aria-label={`Select color ${color}`}
                        title={color}
                      >
                        {image_url ? (
                          <div className="w-12 h-12 bg-white">
                            <img src={image_url} alt={color} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="px-3 py-2 text-sm font-medium bg-white">{color}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Variant list */}
            <div>
              <h3 className="text-base font-semibold mb-2">Variants</h3>
              {variants.length === 0 ? (
                <div className="text-sm text-gray-500">No variant info.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant) => {
                    const labelParts = [variant.color, variant.size, variant.material].filter(Boolean);
                    const label = labelParts.length > 0 ? labelParts.join(" / ") : `Variant ${variant.id}`;
                    const isSelected = selectedVariantId === variant.id;
                    const hero = variantHeroById.get(variant.id) || "/placeholder-image.png";

                    return (
                      <button
                        key={variant.id}
                        onClick={() => {
                          setSelectedVariantId(variant.id);
                          navigate(`/products/${product.id}?variantId=${variant.id}`);
                        }}
                        className={`rounded-xl border p-0 overflow-hidden transition ${isSelected ? "" : "border-gray-300 hover:border-gray-400"}`}
                        style={isSelected ? { borderColor: ACCENT, backgroundColor: "#f8fafc" } : undefined}
                        aria-label={`Select ${label}`}
                        title={label}
                      >
                        <img
                          src={hero}
                          alt={label}
                          className="w-16 h-16 object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Save button (accent) ABOVE "Buy it from" */}
            <div>
              <button
                onClick={() => setSaveOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm"
                style={{ backgroundColor: ACCENT, color: "white" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ACCENT_DARK)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
                aria-label="Save to closet"
              >
                <Bookmark className="w-4 h-4" />
                Save to closet
              </button>
            </div>

            {/* Buy it from (half width + vertical links) */}
            <div className="w-full lg:w-1/2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <h3 className="text-base font-semibold mb-2">Buy it from</h3>

                {vendorLinks.length === 0 ? (
                  <p className="text-sm text-gray-500">No purchase links available yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {vendorLinks.map((v) => (
                      <a
                        key={v.url}
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 transition"
                      >
                        {v.label}
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-2 text-xs text-gray-500">Links open in a new tab.</div>
              </div>
            </div>
          </div>
        </div>

        {/* More like this: grid, show first row only, Load more below */}
        <div className="mt-10">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">More like this</h2>
            <p className="text-sm text-gray-500">Similar items based on this product.</p>
          </div>

          {recoError ? (
            <p className="text-sm text-red-500">Failed to load recommendations.</p>
          ) : recoLoading ? (
            <p className="text-sm text-gray-500">Loading recommendations...</p>
          ) : !recoHasSession ? (
            <p className="text-sm text-gray-500">No recommendations session.</p>
          ) : visibleReco.length === 0 ? (
            <p className="text-sm text-gray-500">No recommendations found.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {visibleReco.map((p: any) => (
                  <div key={p.id} className="w-full">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>

              {/* Load more button (reveals next row) */}
              {canLoadMore && (
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={onLoadMoreReco}
                    disabled={recoInfinite.isFetchingNextPage}
                    className="w-full sm:w-auto sm:min-w-[260px] inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-base font-semibold border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50"
                    aria-label="Load more similar items"
                  >
                    <ChevronDown className="w-5 h-5" />
                    {recoInfinite.isFetchingNextPage ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save to closet modal */}
      <SaveToClosetModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        productId={product.id}
        variantId={selectedVariantId}
      />
    </div>
  );
};

export default ProductDetailPage;
