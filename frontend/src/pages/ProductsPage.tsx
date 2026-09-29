import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import ProductCard from "../components/ProductCard";
import FloatingSearchBar from "../components/FloatingSearchBar";
import type { Product } from "../types";
import { apiClient, type ApiProduct, type SearchProductCard } from "../utils/api";

// ✅ NEW: recent searches hook + type
import { Filter, X } from "lucide-react";
import { useRecentSearches } from "../hooks/search";
import type { RecentSearchItem } from "../components/FloatingSearchBar";
import ChatbotSidebar from "../components/chat/ChatbotSidebar";

// ==========================================
// Reusable Filter Content Component (Mobile)
// ==========================================
type FilterContentProps = {
  searchParams: URLSearchParams;
  refineText: string;
  setRefineText: (s: string) => void;
  submitRefine: () => void;
  clearSearchMode: () => void;
  onApply?: () => void; // for mobile modal to close on apply
};

export const FilterContent: React.FC<FilterContentProps> = ({
  searchParams,
  refineText,
  setRefineText,
  submitRefine,
  clearSearchMode,
  onApply,
}) => {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
          Current search
        </div>
        <div className="text-base font-semibold text-gray-900 leading-snug">
          <span className="line-clamp-2">
            {searchParams.get("search")?.trim()
              ? searchParams.get("search")!.trim()
              : "AI search"}
          </span>
        </div>

        <button
          onClick={clearSearchMode}
          className="mt-3 text-[11px] underline text-gray-700 hover:text-gray-900"
        >
          Back to browsing
        </button>
      </div>

      {/* Refine text */}
      <div className="px-5 py-4 bg-gray-50 flex-1">
        <label className="block text-[11px] uppercase tracking-[0.2em] mb-2 text-gray-600">
          Refine
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {["date night", "more minimal", "more boxy", "more fitted", "warmer tones"].map(
            (chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setRefineText(chip)}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
              >
                {chip}
              </button>
            )
          )}
        </div>

        <div>
          <textarea
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder='Try: “more date night”, “boxier”, “warmer tones”…'
            rows={2}
            className="w-full resize-none p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-black bg-white text-sm"
          />
          <div className="mt-2 flex items-center justify-between">
            {/* Mobile-only close button */}
            <button
              type="button"
              onClick={onApply} // onApply closes the modal in mobile view
              className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900"
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Spacer for desktop alignment if needed, or just let Apply go to the right */}
            <div className="hidden lg:block w-px" />

            <button
              type="button"
              onClick={() => {
                submitRefine();
                if (onApply) onApply();
              }}
              className="px-4 py-2 rounded-lg bg-[#213A53] text-white text-sm hover:opacity-90"
            >
              Refine Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PAGE_SIZE = 20; // normal browse page size
const SEARCH_PAGE_SIZE = 50; // cached search page size (backend default-ish)

function convertApiProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    image: p.image,
    description: p.description,
    category: p.category,
    brand: p.brand,
    inStock: p.inStock,
    rating: p.rating,
    reviewCount: p.reviewCount,
    tags: p.tags,
  };
}

function convertSearchCard(p: SearchProductCard): Product {
  return {
    id: p.product_id ?? p.id,
    productId: p.product_id ?? p.id,
    variantId: p.variant_id ?? undefined,
    name: p.name,
    price: p.price ?? undefined,
    originalPrice: p.originalPrice ?? undefined,
    image: p.matched_variant_image ?? p.image ?? undefined,
    brand: p.brand ?? undefined,
    inStock: p.inStock,
    matchedVariantLabel: p.matched_variant_label ?? undefined,
  };
}

// Helper to resize/compress image for localStorage
async function fileToBase64(file: File, maxSide = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxSide || h > maxSide) {
          if (w > h) {
            h = Math.round(h * (maxSide / w));
            w = maxSide;
          } else {
            w = Math.round(w * (maxSide / h));
            h = maxSide;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper to convert base64 to File for re-upload
function base64ToFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// =====================
// Minimal custom dropdowns (no libs)
// =====================
const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // ======= mode detection =======
  const sid = searchParams.get("sid"); // cached search id from backend
  const isSearchMode = Boolean(sid);

  // ======= normal browse filters (still used by browse-mode API) =======
  // ======= normal browse filters (still used by browse-mode API) =======
  const searchTerm = searchParams.get("search") || "";
  const selectedCategory = searchParams.get("category") || "";
  const selectedMainCategory = searchParams.get("main_category") || "";

  // ======= search bar state =======
  const [prompt, setPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ preview URL for saving image recents (optional thumbnail)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ✅ recent searches (per-user if logged in, otherwise anon)
  const {
    recent: recentSearches,
    add: addRecentSearch,
    remove: removeRecentSearch,
    clear: clearRecentSearches,
    isServerBacked,
  } = useRecentSearches();

  // ✅ Consume Global Search State (Immediate Navigation)
  const location = useLocation();
  const globalSearchState = (location.state as any)?.globalSearch;

  // Initialize isSearching to true if we just arrived with a global search pending
  const [isSearching, setIsSearching] = useState(!!globalSearchState);

  // Trigger global search processing on mount if state exists
  useEffect(() => {
    if (globalSearchState) {
      // Execute search logic with the passed data
      handlePromptSubmit({
        queryText: globalSearchState.queryText,
        file: globalSearchState.file
      });

      // Clear state to prevent re-trigger (replace history)
      navigate(location.pathname + location.search, { state: {}, replace: true });
    }
  }, []); // Only run on mount

  // ✅ Scroll Reset on Filter Change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [
    isSearchMode,
    sid,
    searchTerm,
    selectedCategory,
    selectedMainCategory,
  ]);

  // ======= UI-only: sidebar refine chat =======
  // ======= UI-only: sidebar refine chat =======
  const [refineText, setRefineText] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // ✅ Consolidated Apply Handler (Handles both Hard Filters + AI Refinement)
  // Lock body scroll when filter modal is open on mobile
  useEffect(() => {
    if (isFilterOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFilterOpen]);

  const submitRefine = () => {
    let newSearch = (searchParams.get("search") || "").trim();
    const refinement = refineText.trim();
    if (refinement) {
      newSearch = newSearch ? `${newSearch} ${refinement}` : refinement;
    }

    setSearchParams(prev => {
      if (newSearch) prev.set("search", newSearch);
      else prev.delete("search");
      return prev;
    }, { replace: true });

    setRefineText("");
  };

  const ProductCardSkeleton: React.FC = () => {
    return (
      <div className="bg-white shadow-sm border border-gray-200 overflow-hidden animate-pulse">
        <div className="relative">
          <div className="aspect-[3/4] bg-gray-100" />
          <div className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/80 flex items-center justify-center">
            <div className="h-4 w-4 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-40 bg-gray-100 rounded" />
            </div>
            <div className="flex flex-col items-end">
              <div className="h-4 w-14 bg-gray-200 rounded" />
              <div className="mt-2 h-3 w-10 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const GridLoadingOverlay = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="rounded-full bg-white/90 backdrop-blur-md p-6 shadow-xl border border-gray-100">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-black" />
      </div>
    </div>
  );



  // ============================================================
  // React Query: Infinite Scroll
  // ============================================================

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading,
    isError,
    error: loadError,
  } = useInfiniteQuery({
    // Cache key depends on all filters
    queryKey: [
      "products",
      {
        isSearchMode,
        sid,
        searchTerm,
        selectedCategory,
        selectedMainCategory,
      }
    ],
    queryFn: async ({ pageParam = 1 }) => {
      if (isSearchMode && sid) {
        // Search Cache Pagination
        const res = await apiClient.paginateSearchCache({
          search_id: sid,
          page: pageParam as number,
          page_size: SEARCH_PAGE_SIZE,
        });

        return {
          products: res.products.map(convertSearchCard),
          hasMore: res.has_more,
          nextPage: res.has_more ? (pageParam as number) + 1 : undefined,
        };
      } else {
        // Browse DB Pagination
        const res = await apiClient.getProducts({
          search: searchTerm || undefined,
          category: selectedCategory && selectedCategory !== "all" ? selectedCategory : undefined,
          main_category:
            selectedMainCategory && selectedMainCategory !== "all"
              ? selectedMainCategory
              : undefined,
          page: pageParam as number,
          limit: PAGE_SIZE,
        });

        return {
          products: res.products.map(convertApiProduct),
          hasMore: res.products.length === PAGE_SIZE,
          nextPage: res.products.length === PAGE_SIZE ? (pageParam as number) + 1 : undefined,
        };
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => lastPage.nextPage,
    staleTime: 60_000,
  });

  // Flatten pages into one list

  // Flatten pages into one list
  const products = useMemo(() => data?.pages.flatMap((p: any) => p.products) ?? [], [data]);

  // ✅ Detect 404/410 specifically
  const isNotFound = isError && (
    (loadError as any)?.message?.includes("404") ||
    (loadError as any)?.message?.includes("410") ||
    (loadError as any)?.message?.includes("Search not found") ||
    (loadError as any)?.message?.includes("Search expired")
  );

  // ✅ Determine if we are *going* to try recovering (to mask the error)
  const canRecover = isSearchMode && sid && isNotFound && (
    recentSearches.some(r => r.searchId === sid) || !!searchTerm
  );

  // Show error only if we are NOT recovering
  const error = isError && !canRecover ? (loadError as any)?.message || "Failed to load products" : null;

  // Show loading if Query is loading OR if we are masking a 404 for recovery OR if we are submitting a new search
  const showLoading = loading || canRecover || isSearching;

  // IntersectionObserver triggers loadMore
  const loaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" } // trigger earlier
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);


  // ============================================================
  // Search bar handlers
  // ============================================================
  // Search bar handlers
  const handlePromptSubmit = async (override?: { queryText?: string; file?: File | null }) => {
    const q = (override?.queryText ?? prompt).trim();
    const file = override?.file !== undefined ? override.file : selectedFile;

    if (!q && !file) return;

    try {
      setIsSearching(true);

      const res = await apiClient.searchMultimodalCached({
        file: file ?? undefined,
        query_text: q || undefined,
        page_size: SEARCH_PAGE_SIZE,
      });

      // ✅ Generate preview for recents
      let imgPreview = file ? previewUrl : null;
      if (file && !isServerBacked) {
        // For signed-out users, store a small base64 so it persists across reloads
        try {
          imgPreview = await fileToBase64(file);
        } catch (err) {
          console.warn("Failed to generate base64 preview", err);
        }
      } else if (file && isServerBacked) {
        // For signed-in, backend handles it, but we can optimistically use the blob preview for now
        // On next load, it will use the backend URL
        imgPreview = previewUrl;
      }

      addRecentSearch({
        mode: file && q ? "multimodal" : file ? "image" : "text",
        searchId: res.search_id,
        queryText: q || null,
        queryImageUrl: imgPreview,
      });

      const params = new URLSearchParams(searchParams);
      params.set("sid", res.search_id);
      if (q) params.set("search", q);
      else params.delete("search");

      navigate(`/products?${params.toString()}`);

      // ✅ Clear search bar after successful navigation
      setPrompt("");
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (e: any) {
      console.error(e); // Let React Query handle visual errors effectively on the next render if key changed, or show toast
    } finally {
      setIsSearching(false);
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ✅ Back to browsing should show top products: go to the clean route
  const clearSearchMode = () => {
    navigate("/products");
  };

  // ============================================================
  // Search Recovery Logic
  // ============================================================

  // Reusable search execution (extracted from onSelectRecent)
  const executeSearchFromItem = async (item: RecentSearchItem) => {
    const text = (item.queryText || "").trim();
    let fileToUpload: File | null = null;
    let imgPreviewUrl: string | null = null;

    // If we have an image URL
    if (item.queryImageUrl) {
      if (item.queryImageUrl.startsWith("data:")) {
        // It's a base64 (signed out)
        fileToUpload = base64ToFile(item.queryImageUrl, "recent-search.jpg");
        imgPreviewUrl = URL.createObjectURL(fileToUpload);
      } else if (item.queryImageUrl.startsWith("blob:")) {
        // It's a blob url (session specific). If it expired, this fetch will fail.
        try {
          const blob = await fetch(item.queryImageUrl).then(r => r.blob());
          fileToUpload = new File([blob], "recent-search.jpg", { type: blob.type });
          imgPreviewUrl = URL.createObjectURL(fileToUpload);
        } catch (e) {
          console.warn("Blob expired, cannot re-search image", e);
        }
      } else {
        // It's a remote URL (signed in). Fetch and re-upload
        try {
          const blob = await fetch(item.queryImageUrl).then(r => r.blob());
          fileToUpload = new File([blob], "recent-search.jpg", { type: blob.type });
          imgPreviewUrl = URL.createObjectURL(fileToUpload);
        } catch (e) {
          console.warn("Failed to fetch remote image for re-search", e);
        }
      }
    }

    // Prepare UI state for the retry
    if (text) setPrompt(text);
    if (fileToUpload) {
      setSelectedFile(fileToUpload);
      // If we made a new object URL, track it for cleanup
      if (imgPreviewUrl) setPreviewUrl(imgPreviewUrl);
    }

    if (!text && !fileToUpload) return; // nothing to search

    await handlePromptSubmit({ queryText: text, file: fileToUpload });
  };

  const onSelectRecent = async (item: RecentSearchItem) => {
    const text = (item.queryText || "").trim();

    // ✅ If we have a valid searchId, first TRY to navigate directly.
    // React Query will error 404/410 if expired, then our recovery effect will kick in.
    if (item.searchId) {
      const params = new URLSearchParams(searchParams);
      params.set("sid", item.searchId);
      if (text) params.set("search", text);
      else params.delete("search");
      navigate(`/products?${params.toString()}`);

      // Clear search bar
      setPrompt("");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // ✅ No searchId (unlikely for stored items, but possible): Re-execute immediately
    await executeSearchFromItem(item);
  };

  // ✅ AUTO-RECOVERY: If search fails (404/410), try to re-run it using known context
  const recoveryAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // If not found, and we haven't tried recovering this specific SID yet
    if (isSearchMode && sid && isNotFound && !recoveryAttemptedRef.current.has(sid)) {
      console.log(`[Search Recovery] Search ${sid} expired or not found. Attempting recovery...`);

      // Mark as attempted so we don't double-fire
      recoveryAttemptedRef.current.add(sid);

      // 1. Try to find the exact recent search item
      const item = recentSearches.find(r => r.searchId === sid);
      if (item) {
        console.log("[Search Recovery] Found recent item, re-executing search.");
        void executeSearchFromItem(item);
        return;
      }

      // 2. Fallback: If we have a search term in URL, just run text search
      if (searchTerm) {
        console.log("[Search Recovery] No recent item found, retrying text search.");
        setPrompt(searchTerm);
        void handlePromptSubmit({ queryText: searchTerm });
        return;
      }
    }
  }, [isSearchMode, sid, isNotFound, recentSearches, searchTerm]);

  // =====================
  // Price slider helpers (update URL)
  // =====================

  const gridColsClass = isSearchMode
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5";

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="relative min-h-screen bg-white">
      {/* Floating Search Bar (always visible) */}
      {!isSearchMode && (
        <div className="fixed top-20 left-0 right-0 z-[250] px-6 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <FloatingSearchBar
              prompt={prompt}
              setPrompt={setPrompt}
              onSubmit={() => handlePromptSubmit()}
              onImageUpload={handleUploadClick}
              showImageUpload={true}
              placeholder="Describe what you're shopping for..."
              topOffset={80}
              initialMode="scroll"
              stayCollapsed={true}
              isSubmitting={isSearching || loading}
              recentSearches={recentSearches}
              onSelectRecent={onSelectRecent}
              onClearRecent={clearRecentSearches}
              onRemoveRecent={removeRecentSearch}
              uploadedImageUrl={previewUrl}
              onRemoveUploadedImage={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-col lg:flex-row gap-0">
        {/* LEFT SIDEBAR (SEARCH MODE ONLY) — minimal, no scrolling */}
        {isSearchMode && (
          <>
            {/* Desktop Chatbot Sidebar (30%) */}
            <div className="hidden lg:block lg:w-[30%] flex-shrink-0">
              <div className="sticky top-20 h-[calc(100vh-5rem)] border-r border-gray-200 bg-white">
                <ChatbotSidebar
                  searchParams={searchParams}
                  refineText={refineText}
                  setRefineText={setRefineText}
                  submitRefine={submitRefine}
                  clearSearchMode={clearSearchMode}
                  recentSearches={recentSearches}
                  onSelectRecent={onSelectRecent}
                  onClearRecent={clearRecentSearches}
                  onRemoveRecent={removeRecentSearch}
                  isSearching={isSearching || loading}
                />
              </div>
            </div>

            {/* Mobile Filter Button (fixed bottom-left) */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="lg:hidden fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#213A53] text-white font-semibold shadow-lg hover:bg-[#541818] transition-transform active:scale-95"
            >
              <Filter className="w-5 h-5" />
              <span>Filters</span>
            </button>

            {/* Mobile Filter Modal */}
            {isFilterOpen && (
              <div className="fixed inset-0 z-[300] flex flex-col bg-white lg:hidden animate-in slide-in-from-bottom duration-200">
                {/* Modal Header */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white text-gray-900">
                  <span className="font-bold text-lg">Filters</span>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="p-2 -mr-2 text-gray-600 hover:text-gray-900"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden relative">
                  <ChatbotSidebar
                    searchParams={searchParams}
                    refineText={refineText}
                    setRefineText={setRefineText}
                    submitRefine={() => {
                      submitRefine();
                      setIsFilterOpen(false);
                    }}
                    clearSearchMode={() => {
                      clearSearchMode();
                      setIsFilterOpen(false);
                    }}
                    recentSearches={recentSearches}
                    onSelectRecent={(item) => {
                      onSelectRecent(item);
                      setIsFilterOpen(false);
                    }}
                    onClearRecent={clearRecentSearches}
                    onRemoveRecent={removeRecentSearch}
                    isSearching={isSearching || loading}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Product Grid (70% in search mode) */}
        <div className={`w-full ${isSearchMode ? 'lg:w-[70%]' : 'flex-1'} px-4 sm:px-6 lg:px-8 pt-24 pb-12 lg:pt-28`}>
          {/* While loading first page */}
          {(showLoading && !products.length) && (
            <div className="relative">
              <div className={`grid ${gridColsClass} gap-3 opacity-70`}>
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
              <GridLoadingOverlay />
            </div>
          )}

          {products.length > 0 && !isSearching && (
            <div className={`grid ${gridColsClass} gap-3`}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} viewMode="grid" />
              ))}
            </div>
          )}

          {!showLoading && products.length === 0 && !isSearching && (
            <p className="text-center text-gray-500 mt-20">No products found.</p>
          )}

          <div ref={loaderRef} className="py-10 text-center">
            {isFetchingNextPage && (
              <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-black rounded-full mx-auto" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
