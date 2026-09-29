// frontend/src/pages/BrandsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Heart, Search, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";

import BrandsCarousel from "../components/BrandsCarousel";
import { apiClient } from "../utils/api";
import type { BrandWithImage as UiBrandWithImage } from "../types";
import type { BrandWithImage as ApiBrandWithImage } from "../utils/api";

// ✅ feature gate modal (redirect happens from modal buttons)
import { SignInToAccessModal } from "../components/AuthButtons";

type SectionKey = "#" | string;

const ACCENT = "#213A53";

function getSectionKey(name: string): SectionKey {
  const first = (name || "").trim().charAt(0);
  if (!first) return "#";
  if (!/^[A-Za-z0-9]$/.test(first)) return "#";
  // numbers fold into "#"
  if (/^[0-9]$/.test(first)) return "#";
  return first.toUpperCase();
}

const SECTION_ORDER: SectionKey[] = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

function sectionSortIndex(k: SectionKey) {
  const idx = SECTION_ORDER.indexOf(k);
  return idx === -1 ? SECTION_ORDER.length : idx;
}

function sortBrandsByName(a: UiBrandWithImage, b: UiBrandWithImage) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
}

// api.ts BrandWithImage has id:number, UI BrandWithImage expects id:string
function toUiBrand(b: ApiBrandWithImage): UiBrandWithImage {
  return { ...b, id: String(b.id) } as UiBrandWithImage;
}

// Fetch ALL brands (paginate) — used by React Query for caching
async function fetchAllBrands(): Promise<UiBrandWithImage[]> {
  const limit = 200;
  let page = 1;

  const first = await apiClient.getBrands(page, limit);
  const all: UiBrandWithImage[] = (first.brands || []).map(toUiBrand);
  const totalPages = first.total_pages || 1;

  for (page = 2; page <= totalPages; page++) {
    const res = await apiClient.getBrands(page, limit);
    all.push(...(res.brands || []).map(toUiBrand));
  }

  return all;
}

// react-query key
const BrandsPage: React.FC = () => {
  const qc = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth0();
  const favoritesQueryKey = ["favorite-brand-ids", user?.sub ?? "anon"] as const;

  // ✅ feature gate modal state
  const [gateOpen, setGateOpen] = useState(false);

  // ---------------------------
  // Cached brands query
  // ---------------------------
  const {
    data: brands = [],
    isLoading: loading,
    isError,
    error,
  } = useQuery({
    queryKey: ["brands", "all"],
    queryFn: fetchAllBrands,
    staleTime: 1000 * 60 * 10, // 10 min
    gcTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // ---------------------------
  // Search
  // ---------------------------
  const [search, setSearch] = useState("");

  // ---------------------------
  // Favorites (DB-backed, auth-gated)
  // ---------------------------
  const favQuery = useQuery({
    queryKey: favoritesQueryKey,
    queryFn: () => apiClient.getMyFavoriteBrandIds(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const favoriteIds = useMemo(() => {
    const ids = favQuery.data?.brand_ids ?? [];
    return new Set(ids.map((x) => String(x)));
  }, [favQuery.data]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (args: { brandId: string; next: boolean }) => {
      const idNum = Number(args.brandId);
      if (!Number.isFinite(idNum)) throw new Error("Invalid brand id");
      return args.next ? apiClient.favoriteBrand(idNum) : apiClient.unfavoriteBrand(idNum);
    },
    onMutate: async ({ brandId, next }) => {
      await qc.cancelQueries({ queryKey: favoritesQueryKey });
      const prev = qc.getQueryData<{ brand_ids: number[] }>(favoritesQueryKey);

      qc.setQueryData<{ brand_ids: number[] }>(favoritesQueryKey, (old) => {
        const cur = old?.brand_ids ?? [];
        const set = new Set(cur.map(String));
        if (next) set.add(String(brandId));
        else set.delete(String(brandId));
        return { brand_ids: Array.from(set).map(Number).filter(Number.isFinite) };
      });

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(favoritesQueryKey, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: favoritesQueryKey });
    },
  });

  // ---------------------------
  // Filtered brands
  // ---------------------------
  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, search]);

  // ---------------------------
  // Grouped sections (# then A-Z)
  // ---------------------------
  const grouped = useMemo(() => {
    const map = new Map<SectionKey, UiBrandWithImage[]>();

    for (const b of filteredBrands) {
      const key = getSectionKey(b.name);
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort(sortBrandsByName);
      map.set(k, arr);
    }

    const keys = Array.from(map.keys()).sort((a, b) => {
      const da = sectionSortIndex(a);
      const db = sectionSortIndex(b);
      if (da !== db) return da - db;
      return String(a).localeCompare(String(b));
    });

    return { map, keys };
  }, [filteredBrands]);

  const tocKeys = grouped.keys;

  const carouselBrands = useMemo(() => {
    const withCounts = brands.some((b) => b.productCount != null);
    if (withCounts) {
      return [...brands]
        .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
        .slice(0, 20);
    }
    return brands.slice(0, 20);
  }, [brands]);

  const errorMessage =
    isError && error instanceof Error ? error.message : isError ? "Failed to load brands" : null;

  // ---------------------------
  // ✅ Active TOC underline (current section)
  // ---------------------------
  const [activeKey, setActiveKey] = useState<SectionKey>("#");

  useEffect(() => {
    if (loading || errorMessage) return;
    if (!tocKeys.length) return;

    const observed: Element[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];

        if (!visible?.target) return;

        const id = (visible.target as HTMLElement).id; // brand-section-<encoded>
        const encoded = id.replace("brand-section-", "");
        const decoded = decodeURIComponent(encoded);
        setActiveKey(decoded as SectionKey);
      },
      {
        root: null,
        // align with fixed TOC height so "active" updates feel correct
        rootMargin: "-120px 0px -70% 0px",
        threshold: [0.1, 0.25, 0.4],
      }
    );

    for (const k of tocKeys) {
      const el = document.getElementById(`brand-section-${encodeURIComponent(String(k))}`);
      if (el) {
        observer.observe(el);
        observed.push(el);
      }
    }

    if (!tocKeys.includes(activeKey)) setActiveKey(tocKeys[0] ?? "#");

    return () => {
      observed.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, errorMessage, tocKeys.join("|")]);

  // ---------------------------
  // ✅ Show a fixed TOC ONLY after you scroll past the in-page TOC
  // (Portal to body so it isn't broken by transforms/overflows in layout)
  // ---------------------------
  const tocSentinelRef = useRef<HTMLDivElement | null>(null);
  const [showFixedToc, setShowFixedToc] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = tocSentinelRef.current;
    if (!el) return;

    // Use scroll listener for sticky TOC toggle (more robust on mobile than sentinel IO)
    const handleScroll = () => {
      const el = tocSentinelRef.current;
      if (!el) return;
      // If we've scrolled past the sentinel (its top is negative), show fixed TOC
      const rect = el.getBoundingClientRect();
      const isPast = rect.top < 0;
      setShowFixedToc(isPast);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Run once on mount
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (k: SectionKey) => {
    const el = document.getElementById(`brand-section-${encodeURIComponent(String(k))}`);
    if (!el) return;

    const fixedOffset = 64 + 88; // approx navbar + fixed toc height
    const top = el.getBoundingClientRect().top + window.scrollY - fixedOffset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const TocRow = ({ compact }: { compact?: boolean }) => (
    <div
      className={
        compact
          ? "flex flex-wrap justify-center gap-x-5 gap-y-2"
          : "flex flex-wrap justify-center gap-x-6 gap-y-3"
      }
    >
      {tocKeys.map((k) => {
        const isActive = activeKey === k;
        return (
          <a
            key={k}
            href={`#brand-section-${encodeURIComponent(String(k))}`}
            className="group relative"
            onClick={(e) => {
              e.preventDefault();
              setActiveKey(k);
              scrollToSection(k);
            }}
          >
            {/* heading font comes from your global h-tag styling */}
            <h2
              className={`text-2xl sm:text-3xl transition-colors ${k === "#" ? "font-extrabold" : ""}`}
              style={{ color: isActive ? ACCENT : undefined }}
            >
              {k}
            </h2>

            {/* underline: hover + active */}
            <span
              className={[
                "pointer-events-none absolute left-0 -bottom-1 h-[2px] w-full origin-left transition-transform duration-200 ease-out",
                isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
              ].join(" ")}
              style={{ backgroundColor: ACCENT }}
            />
          </a>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <div id="top" />

      {/* ✅ Fixed TOC (only after you scroll past the in-page TOC) */}
      {mounted &&
        createPortal(
          <div
            className={[
              "fixed left-0 right-0 z-[1001]", // z-1001 to appear above search bar (z-250 container but potentially safer)
              "top-16", // offset below navbar (64px)
              "transition-all duration-300",
              showFixedToc ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none",
            ].join(" ")}
          >
            <div className="backdrop-blur bg-white/70 border-b border-gray-200">
              <div className="container mx-auto px-4 py-3">
                <TocRow compact />
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Header */}
      <div className="container mx-auto px-4">
        <h1 className="text-center text-3xl font-bold pt-16">Brands</h1>
        <p className="text-center text-gray-500 mt-2">
          Favorite brands to tune your feed and catch drops faster.
        </p>
      </div>

      {/* Full-bleed Carousel */}
      <section className="pt-8">
        <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
          <div className="w-screen px-4">
            {loading ? (
              <div className="h-28 rounded-xl bg-gray-100 animate-pulse" />
            ) : errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : (
              <BrandsCarousel brands={carouselBrands} speed={-0.35} />
            )}
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="pt-6">
        <div className="container mx-auto px-4">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search brands..."
                className="w-full bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
              />
              {search.trim() && (
                <button
                  onClick={() => setSearch("")}
                  className="p-1 rounded-md hover:bg-gray-100"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {filteredBrands.length.toLocaleString()} brands
            {search.trim() ? " (filtered)" : ""}
          </div>
        </div>
      </section>

      {/* In-page TOC (normal flow, NOT at top initially) */}
      <section className="pt-8">
        <div className="container mx-auto px-4">
          <TocRow compact={false} />
        </div>
      </section>

      {/* Sentinel: once this scrolls out of view, we are "past" the TOC region */}
      <div ref={tocSentinelRef} className="h-px w-full" />

      {/* Brand grid */}
      <section className="py-16">
        <div className="container mx-auto px-4 space-y-12">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : grouped.keys.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No brands match your search.</div>
          ) : (
            grouped.keys.map((k) => {
              const items = grouped.map.get(k) || [];
              if (!items.length) return null;

              return (
                <section
                  key={k}
                  id={`brand-section-${encodeURIComponent(String(k))}`}
                  className="scroll-mt-28"
                >
                  <div className="flex items-end justify-between">
                    <h2 className="text-xl font-bold text-gray-800">{k}</h2>
                    <a
                      href="#top"
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={(e) => {
                        e.preventDefault();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Back to top
                    </a>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-3">
                    {items.map((b) => {
                      const isFav = favoriteIds.has(b.id);

                      return (
                        <div
                          key={b.id}
                          className="group flex items-center justify-between gap-2 px-2 py-1 rounded-md hover:bg-gray-100"
                        >
                          <Link
                            to={`/brands/${b.id}`}
                            className="min-w-0 flex-1 truncate text-sm text-gray-800"
                            title={b.name}
                          >
                            {b.name}
                          </Link>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (authLoading) return;

                              if (!isAuthenticated) {
                                // ✅ in-page feature gate modal (no surprise redirect)
                                setGateOpen(true);
                                return;
                              }

                              toggleFavoriteMutation.mutate({ brandId: b.id, next: !isFav });
                            }}
                            disabled={toggleFavoriteMutation.isPending}
                            className="shrink-0 p-1 rounded-md hover:bg-white/70 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={isFav ? "Unfavorite brand" : "Favorite brand"}
                            title={!isAuthenticated ? "Sign in to favorite" : isFav ? "Unfavorite" : "Favorite"}
                          >
                            <Heart
                              className="h-4 w-4"
                              style={isFav ? { color: "#213A53", fill: "#213A53" } : undefined}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </section>

      {/* ✅ Sign-in gate modal */}
      <SignInToAccessModal open={gateOpen} onClose={() => setGateOpen(false)} reason="favorite" />
    </div>
  );
};

export default BrandsPage;
