// frontend/src/pages/BrandDetailPage.tsx
import React, { useMemo, useRef, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";

import { apiClient, convertApiProduct } from "../utils/api";
import ProductCard from "../components/ProductCard";

import { SignInToAccessModal } from "../components/AuthButtons";
import { useBrand } from "../hooks/brands";
import { useBrandProducts } from "../hooks/products";

const ACCENT = "#213A53";

const PAGE_SIZE = 48;

const BrandDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { brandId } = useParams<{ brandId: string }>();

  const { isAuthenticated, isLoading: authLoading, user } = useAuth0();
  const qc = useQueryClient();
  const favoritesQueryKey = ["favorite-brand-ids", user?.sub ?? "anon"] as const;

  // ✅ in-page feature gate modal (no surprise redirect)
  const [gateOpen, setGateOpen] = useState(false);

  const brandIdNum = brandId ? Number(brandId) : null;

  // Pull brand details
  const { data: brand, isLoading: brandLoading } = useBrand(brandIdNum);

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

  const isFav = brandId ? favoriteIds.has(brandId) : false;

  // ============================================================
  // Brand products (infinite scroll grid)
  // ============================================================
  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: productsLoading,
    error
  } = useBrandProducts(brandIdNum!, {
    limit: PAGE_SIZE,
  });
  // Note: useBrandProducts handles 'enabled: !!brandId' so it won't run if id is null

  const products = useMemo(() => {
    return productsData?.pages.flatMap((page) => page.products) ?? [];
  }, [productsData]);

  const loaderRef = useRef<HTMLDivElement | null>(null);

  // IntersectionObserver triggers fetchNextPage
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4">
        {/* Top row */}
        <div className="pt-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm text-gray-700 hover:underline"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        <div className="pt-8 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold truncate">
              {brandLoading ? "Loading..." : brand?.name || "Brand"}
            </h1>
            <p className="text-gray-500 mt-2">
              {brand?.productCount != null
                ? `${brand.productCount.toLocaleString()} products`
                : "Browse products from this brand"}
            </p>
          </div>

          {brandId && (
            <button
              type="button"
              onClick={() => {
                if (authLoading) return;

                if (!isAuthenticated) {
                  setGateOpen(true);
                  return;
                }

                toggleFavoriteMutation.mutate({ brandId, next: !isFav });
              }}
              disabled={toggleFavoriteMutation.isPending}
              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isFav ? "Unfavorite brand" : "Favorite brand"}
              title={!isAuthenticated ? "Sign in to favorite" : isFav ? "Unfavorite" : "Favorite"}
            >
              <Heart
                className={`h-4 w-4 ${isFav ? "" : "text-gray-600"}`}
                style={isFav ? { color: ACCENT, fill: ACCENT } : undefined}
              />
              <span className="text-sm">{isFav ? "Favorited" : "Favorite"}</span>
            </button>
          )}
        </div>

        {/* Products */}
        <div className="py-10">
          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-56 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error instanceof Error ? error.message : "Failed to load products"}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No products found for this brand.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={convertApiProduct(p)} />
                ))}
              </div>

              {/* Infinite scroll loader */}
              <div ref={loaderRef} className="h-10" />

              {isFetchingNextPage && (
                <div className="mt-6 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-400 border-t-black" />
                </div>
              )}

              {!hasNextPage && products.length > 0 && (
                <div className="mt-8 text-center text-sm text-gray-500">You’ve reached the end.</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ✅ Sign-in gate modal */}
      <SignInToAccessModal open={gateOpen} onClose={() => setGateOpen(false)} reason="favorite" />
    </div>
  );
};

export default BrandDetailPage;
