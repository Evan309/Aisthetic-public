import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Globe2,
  Lock,
  Settings,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import ClosetProductCard from "../components/ClosetProductCard";
import ClosetSettingsModal from "../components/ClosetSettingsModal";
import UserAvatarStack from "../components/UserAvatarStack";

import {
  useCloset,
  useClosetItemCards,
  useUpdateCloset,
  useDeleteCloset,
  useRemoveItemFromCloset,
} from "../hooks/closets";

import ProductCard from "../components/ProductCard";
import { useStartClosetRecommendations, useCachedSearch } from "../hooks/search";


const PAGE_SIZE = 48;

const ACCENT = "#213A53";
const RING_STYLE = { "--tw-ring-color": ACCENT } as React.CSSProperties;

type SavedItemsSort = "recently_added" | "name" | "price_low" | "price_high";

const SORT_OPTIONS: Array<{ value: SavedItemsSort; label: string }> = [
  { value: "recently_added", label: "Recently added" },
  { value: "name", label: "Name" },
  { value: "price_low", label: "Price (low → high)" },
  { value: "price_high", label: "Price (high → low)" },
];

function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [ref, handler]);
}

function SavedItemsSortDropdown(props: {
  value: SavedItemsSort;
  onChange: (v: SavedItemsSort) => void;
}) {
  const { value, onChange } = props;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(rootRef, () => setOpen(false));

  const current = useMemo(
    () => SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0],
    [value]
  );
  const CaretIcon = open ? ChevronUp : ChevronDown;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 shadow-sm hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={RING_STYLE}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1">
          <SlidersHorizontal className="h-4 w-4" />
        </span>

        {/* ✅ 4 full chars then cutoff (keeps button width consistent) */}
        <span className="hidden md:inline-block w-[4ch] truncate text-gray-800">
          {current.label}
        </span>

        <CaretIcon className="h-4 w-4 text-gray-500" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 -translate-x-1/2 mt-2 w-[260px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl z-[200]"
        >
          <div className="px-4 pt-4 pb-3 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-900">Sort</div>
            <div className="mt-0.5 text-xs text-gray-500">{current.label}</div>
          </div>

          <div className="py-2">
            {SORT_OPTIONS.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={[
                    "w-full px-4 py-2.5 text-left text-sm transition",
                    active ? "bg-gray-50" : "hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex items-center gap-2">
                      {active ? (
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-md"
                          style={{ backgroundColor: "rgba(106, 30, 30, 0.08)" }}
                        >
                          <Check className="h-4 w-4" style={{ color: ACCENT }} />
                        </span>
                      ) : (
                        <span className="h-5 w-5" />
                      )}

                      <span
                        className={
                          active
                            ? "font-semibold text-gray-900 truncate"
                            : "text-gray-900 truncate"
                        }
                      >
                        {opt.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const ClosetDetailPage: React.FC = () => {
  const { closetId } = useParams<{ closetId: string }>();
  const navigate = useNavigate();

  const [settingsOpen, setSettingsOpen] = useState(false);


  // Recommendations cached-search session id
  const [recoSearchId, setRecoSearchId] = useState<string | null>(null);

  // Guards to prevent duplicate "start recs" calls (StrictMode + rerenders)
  const inflightRef = useRef(false);
  const lastKeyRef = useRef<string | null>(null);

  const closetIdNum = useMemo(() => {
    const n = Number(closetId);
    return Number.isFinite(n) ? n : undefined;
  }, [closetId]);

  // 1) Closet metadata
  const {
    data: closet,
    isLoading: closetLoading,
    error: closetErr,
  } = useCloset(closetIdNum, true);

  // 2) Item cards (optimized endpoint)
  const {
    data: cards,
    isLoading: cardsLoading,
    error: cardsErr,
  } = useClosetItemCards(closetIdNum, true, PAGE_SIZE, 0);

  const items = cards ?? [];
  const itemsCount = items.length;

  // Permissions
  const isOwner = closet?.role === "owner";
  const canEdit = isOwner || closet?.role === "editor";

  // ============================================================
  // Saved items filters
  // ============================================================
  const [itemsQuery, setItemsQuery] = useState<string>("");
  const [itemsSort, setItemsSort] = useState<SavedItemsSort>("recently_added");

  const visibleItems = useMemo(() => {
    const q = itemsQuery.trim().toLowerCase();

    const filtered = !q
      ? items
      : items.filter((c) => {
        const p = c.product;
        const hay = `${p.name ?? ""} ${p.brand ?? ""} ${p.category ?? ""}`.toLowerCase();
        return hay.includes(q);
      });

    const sorted = [...filtered].sort((a, b) => {
      if (itemsSort === "recently_added") {
        return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
      }
      if (itemsSort === "name") {
        return (a.product.name ?? "").localeCompare(b.product.name ?? "");
      }
      if (itemsSort === "price_low") {
        const ap = a.product.price ?? Number.POSITIVE_INFINITY;
        const bp = b.product.price ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      }
      if (itemsSort === "price_high") {
        const ap = a.product.price ?? Number.NEGATIVE_INFINITY;
        const bp = b.product.price ?? Number.NEGATIVE_INFINITY;
        return bp - ap;
      }
      return 0;
    });

    return sorted;
  }, [items, itemsQuery, itemsSort]);

  const updateCloset = useUpdateCloset();
  const deleteCloset = useDeleteCloset();
  const removeItem = useRemoveItemFromCloset();

  // 3) Start closet recommendations (mutation)
  const startRecs = useStartClosetRecommendations();

  // Stable fingerprint of closet contents (use product IDs, not item IDs)
  const productsKey = useMemo(() => {
    return items
      .map((x) => x.product.id)
      .sort((a, b) => a - b)
      .join(",");
  }, [items]);

  const qc = useQueryClient();

  // Start (or restart) recommendations ONLY when closet contents change
  useEffect(() => {
    if (!closetIdNum) return;

    if (!productsKey) {
      lastKeyRef.current = null;
      setRecoSearchId(null);
      return;
    }

    const cacheKey = `${closetIdNum}:${productsKey}`;

    const cachedSearchId = qc.getQueryData<string>(["closetRecoSession", cacheKey]);
    if (cachedSearchId) {
      lastKeyRef.current = cacheKey;
      setRecoSearchId(cachedSearchId);
      return;
    }

    if (lastKeyRef.current === cacheKey && recoSearchId) return;
    if (inflightRef.current) return;
    inflightRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const firstPage = await startRecs.mutateAsync({
          closetId: closetIdNum,
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
  }, [closetIdNum, productsKey, qc]);

  // 4) Paginate recommendations via cached search
  const recoInfinite = useCachedSearch(recoSearchId);

  const recoHasSession = !!recoSearchId;
  const recoLoading =
    startRecs.isPending || (recoHasSession && recoInfinite.isLoading && !recoInfinite.data);
  const recoError = startRecs.isError || recoInfinite.isError;

  const recommendedProducts = recoInfinite.data?.pages.flatMap((p) => p.products) ?? [];

  // ============================================================
  // "More like this" display logic
  // ============================================================

  const [recoVisiblePages, setRecoVisiblePages] = useState<number>(1);
  const [recoShowFirstRowOnly, setRecoShowFirstRowOnly] = useState<boolean>(true);

  const [recoCols, setRecoCols] = useState<number>(() => {
    if (typeof window === "undefined") return 5;
    const w = window.innerWidth;
    if (w >= 1024) return 5;
    if (w >= 768) return 3;
    return 2;
  });

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setRecoCols(w >= 1024 ? 5 : w >= 768 ? 3 : 2);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setRecoVisiblePages(1);
    setRecoShowFirstRowOnly(true);
  }, [closetIdNum, productsKey]);

  const firstPage = recoInfinite.data?.pages?.[0];
  const inferredPageSize = firstPage?.products?.length || 20;

  const fullPagesVisibleCount = recoVisiblePages * inferredPageSize;

  const visibleRecoCount = recoShowFirstRowOnly
    ? Math.min(recoCols, recommendedProducts.length)
    : Math.min(fullPagesVisibleCount, recommendedProducts.length);

  const visibleReco = recommendedProducts.slice(0, visibleRecoCount);

  const hasMoreLoaded = recommendedProducts.length > visibleRecoCount;
  const canLoadMore = hasMoreLoaded || !!recoInfinite.hasNextPage;

  const onLoadMoreReco = async () => {
    if (recoShowFirstRowOnly) {
      setRecoShowFirstRowOnly(false);
      if (
        recommendedProducts.length < inferredPageSize &&
        recoInfinite.hasNextPage &&
        !recoInfinite.isFetchingNextPage
      ) {
        await recoInfinite.fetchNextPage();
      }
      return;
    }

    const nextVisible = (recoVisiblePages + 1) * inferredPageSize;

    if (recommendedProducts.length >= nextVisible) {
      setRecoVisiblePages((p) => p + 1);
      return;
    }

    if (recoInfinite.hasNextPage && !recoInfinite.isFetchingNextPage) {
      await recoInfinite.fetchNextPage();
      setRecoVisiblePages((p) => p + 1);
    }
  };

  const loading = closetLoading || cardsLoading;

  if (!closetIdNum) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="text-red-500 mb-4">Closet not found.</p>
        <Link
          to="/closets"
          className="inline-flex items-center text-sm text-gray-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to closets
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="text-gray-500">Loading closet...</p>
      </div>
    );
  }

  if (closetErr || !closet) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="text-red-500 mb-4">
          {closetErr instanceof Error ? closetErr.message : "Closet not found."}
        </p>
        <Link
          to="/closets"
          className="inline-flex items-center text-sm text-gray-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to closets
        </Link>
      </div>
    );
  }

  const handleSaveSettings = async (payload: {
    name: string;
    description: string | null;
  }) => {
    await updateCloset.mutateAsync({
      closetId: closetIdNum,
      payload: {
        name: payload.name,
        description: payload.description,
      },
    });
    setSettingsOpen(false);
  };

  const handleDeleteCloset = async () => {
    await deleteCloset.mutateAsync(closetIdNum);
    navigate("/closets");
  };

  const mutationBusy = updateCloset.isPending || deleteCloset.isPending || removeItem.isPending;

  return (
    <div className="relative min-h-screen bg-white pb-28">

      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link
            to="/closets"
            className="inline-flex items-center text-sm text-gray-700 hover:underline"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Link>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">{closet.name}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 min-h-[24px]">
              {closet.collaborators && closet.collaborators.length > 0 ? (
                <div className="flex items-center gap-2">
                  <UserAvatarStack
                    owner={closet.owner}
                    collaborators={closet.collaborators}
                    maxAvatars={5}
                  />
                  {closet.role !== "owner" && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({closet.role === "editor" ? "You can edit" : "You can view"})
                    </span>
                  )}
                </div>
              ) : closet.view_token ? (
                <>
                  <Globe2 className="w-4 h-4" />
                  <span>Shared via link</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Private closet</span>
                </>
              )}
            </div>

            {closet.description && (
              <p className="mt-2 text-gray-600 text-base max-w-xl">{closet.description}</p>
            )}
          </div>

          <div className="text-sm text-gray-500">
            {itemsCount} saved item{itemsCount === 1 ? "" : "s"}
          </div>
        </div>

        {/* Items */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Items</h2>
          </div>

          {items.length > 0 && (
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:max-w-md">
                <label className="sr-only" htmlFor="closet-items-search">
                  Search saved items
                </label>
                <input
                  id="closet-items-search"
                  value={itemsQuery}
                  onChange={(e) => setItemsQuery(e.target.value)}
                  placeholder="Search items by name, brand, or category"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#213A53]/20 focus:border-[#213A53]"
                />
              </div>

              {/* ✅ Sort + Settings group (matches ClosetsPage button language) */}
              <div className="w-full sm:w-auto flex justify-end">
                <div className="flex items-center gap-2">
                  <SavedItemsSortDropdown value={itemsSort} onChange={setItemsSort} />

                  {/* ✅ Settings icon button (Owner only) */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      disabled={mutationBusy}
                      aria-label="Closet settings"
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 shadow-sm hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60"
                      style={RING_STYLE}
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {cardsErr ? (
            <p className="text-sm text-red-500">
              {cardsErr instanceof Error ? cardsErr.message : "Failed to load items."}
            </p>
          ) : visibleItems.length === 0 ? (
            <div className="min-h-[42vh] flex items-center justify-center">
              <div className="text-center">
                {items.length === 0 ? (
                  <>
                    <p className="text-sm text-gray-800">
                      There aren’t any items in this closet yet
                    </p>
                    <p className="mt-2 text-sm text-gray-500 pb-4">
                      Browse products and save them here.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-800">No matches</p>
                    <p className="mt-2 text-sm text-gray-500 pb-4">
                      Try a different search.
                    </p>
                  </>
                )}
                <button
                  onClick={() => navigate("/products")}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition"
                  style={{ backgroundColor: ACCENT }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#112233")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
                >
                  Browse
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {visibleItems.map((c) => (
                <ClosetProductCard
                  key={c.item_id}
                  itemId={c.item_id}
                  product={c.product}
                  removing={removeItem.isPending}
                  canRemove={canEdit}
                  onRemove={(itemId) => {
                    removeItem.mutate({ closetId: closetIdNum, itemId });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Settings Modal */}
        <ClosetSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          closet={closet}
          onSave={handleSaveSettings}
          saving={updateCloset.isPending}
          onDelete={handleDeleteCloset}
          deleting={deleteCloset.isPending}
        />

        {/* More like this */}
        <div className="mt-16">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold">More like this closet</h2>
              <p className="text-sm text-gray-500">
                Recommendations based on the items saved here.
              </p>
            </div>
          </div>

          {recoError ? (
            <p className="text-sm text-red-500">Failed to load recommendations.</p>
          ) : recoLoading ? (
            <p className="text-sm text-gray-500">Loading recommendations...</p>
          ) : !recoHasSession ? (
            <div className="relative">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="aspect-[4/5] bg-gray-100" />
                    <div className="p-4">
                      <div className="h-4 w-24 bg-gray-200 rounded" />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="h-4 w-40 bg-gray-200 rounded" />
                        <div className="h-4 w-14 bg-gray-200 rounded" />
                      </div>
                      <div className="mt-2 h-3 w-36 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center px-4 py-2">
                  <p className="text-sm font-medium text-gray-800">No recommendations yet</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Save a few items to see more like this.
                  </p>
                </div>
              </div>

              <div className="absolute inset-0 bg-white/20" />
            </div>
          ) : recommendedProducts.length === 0 ? (
            <div className="min-h-[34vh] flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-800">
                  There aren’t any recommendations to show
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Try adding more items to refine this closet’s vibe.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {visibleReco.map((p) => (
                  <ProductCard key={p.id} product={p as any} />
                ))}
              </div>

              {canLoadMore ? (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={onLoadMoreReco}
                    disabled={recoInfinite.isFetchingNextPage}
                    className="w-full sm:w-auto sm:min-w-[260px] inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-base font-semibold border border-gray-300 hover:border-gray-400 bg-white disabled:opacity-50"
                  >
                    <ChevronDown className="w-5 h-5" />
                    {recoInfinite.isFetchingNextPage ? "Loading..." : "Load more"}
                  </button>
                </div>
              ) : (
                <div className="mt-6 flex justify-center">
                  <p className="text-sm text-gray-400">End of results</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClosetDetailPage;
