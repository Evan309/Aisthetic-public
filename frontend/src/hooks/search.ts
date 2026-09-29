import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  apiClient,
  type CachedSearchResponse,
  type RecentSearchItemOut,
} from "../utils/api";
import { logger } from "../utils/logger";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type RecentSearch,
  loadRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from "../utils/recentSearches";
import { useAuth0 } from "@auth0/auth0-react";

const PAGE_SIZE = 20; // match your grid load size (or 50 if you want)
const RECENTS_LIMIT = 12;

export function useStartMultimodalSearch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { file?: File; query_text?: string }) => {
      return apiClient.searchMultimodalCached({
        file: args.file,
        query_text: args.query_text,
        page_size: PAGE_SIZE,
      });
    },
    onSuccess: (firstPage) => {
      // Seed the infinite query cache so page 1 renders instantly
      qc.setQueryData(["cachedSearch", firstPage.search_id, PAGE_SIZE], {
        pages: [firstPage],
        pageParams: [1],
      });

      // ✅ If user is signed in, backend just wrote SearchSession -> refresh DB recents
      qc.invalidateQueries({ queryKey: ["recentSearches"] });
    },
  });
}

export function useCachedSearch(
  searchId: string | null,
) {
  return useInfiniteQuery<CachedSearchResponse>({
    queryKey: ["cachedSearch", searchId, PAGE_SIZE],
    enabled: !!searchId,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!searchId) throw new Error("missing searchId");
      return apiClient.paginateSearchCache({
        search_id: searchId,
        page: pageParam as number,
        page_size: PAGE_SIZE,
      });
    },
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}


export function useStartSimilarProducts() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { productId: number; variantId?: number | null; cacheKey: string }) => {
      const firstPage = await apiClient.similarProductsCached({
        product_id: args.productId,
        variant_id: args.variantId,
        page_size: PAGE_SIZE,
        ttl_minutes: 60,
      });

      // seed infinite cache SAME SHAPE + SAME KEY as useCachedSearch
      qc.setQueryData(["cachedSearch", firstPage.search_id, PAGE_SIZE], {
        pages: [firstPage],
        pageParams: [1],
      });

      // ✅ persist mapping from product-state -> search_id
      qc.setQueryData(["productRecoSession", args.cacheKey], firstPage.search_id);

      return firstPage;
    },
  });
}

// hooks/search.ts
export function useStartClosetRecommendations() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { closetId: number; cacheKey: string }) => {
      const firstPage = await apiClient.closetRecommendationsCached({
        closet_id: args.closetId,
        page_size: PAGE_SIZE,
        ttl_minutes: 60,
      });

      // seed infinite cache
      qc.setQueryData(["cachedSearch", firstPage.search_id, PAGE_SIZE], {
        pages: [firstPage],
        pageParams: [1],
      });

      // ✅ persist mapping from closet-state -> search_id
      qc.setQueryData(["closetRecoSession", args.cacheKey], firstPage.search_id);

      return firstPage;
    },
  });
}

// ------------------------------------------------------------
// Recent Searches (HYBRID)
// ------------------------------------------------------------

function mapServerRecentToLocal(
  r: RecentSearchItemOut,
  ownerKey: string
): RecentSearch {
  return {
    id: String(r.id), // server uses int session_id
    ownerKey,
    mode: r.mode,
    searchId: r.search_id ?? null,
    queryText: r.query_text ?? null,
    queryImageUrl: r.query_image_url ?? null,
    createdAt: r.created_at,
  };
}

export function useRecentSearches() {
  const qc = useQueryClient();
  const { user, isAuthenticated } = useAuth0();

  const ownerKey = useMemo(() => {
    if (isAuthenticated && user?.sub) return `auth0:${user.sub}`;
    return "anon";
  }, [isAuthenticated, user?.sub]);

  // ---------- Local fallback (signed out) ----------
  const [localRecent, setLocalRecent] = useState<RecentSearch[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      const loaded = loadRecentSearches(ownerKey);
      logger.log('[DEBUG] Loaded recent searches from localStorage:', loaded.map(r => ({
        id: r.id,
        mode: r.mode,
        hasImage: !!r.queryImageUrl,
        imageStart: r.queryImageUrl?.substring(0, 30)
      })));
      setLocalRecent(loaded);
    }
  }, [ownerKey, isAuthenticated]);

  const addLocal = useCallback(
    (input: {
      mode: RecentSearch["mode"];
      searchId?: string | null;
      queryText?: string | null;
      queryImageUrl?: string | null;
    }) => {
      setLocalRecent(addRecentSearch({ ownerKey, ...input }));
    },
    [ownerKey]
  );

  const removeLocal = useCallback(
    (id: string) => setLocalRecent(removeRecentSearch(ownerKey, id)),
    [ownerKey]
  );

  const clearLocal = useCallback(() => {
    clearRecentSearches(ownerKey);
    setLocalRecent([]);
  }, [ownerKey]);

  // ---------- Server-backed (signed in) ----------
  const serverQuery = useQuery({
    queryKey: ["recentSearches", ownerKey],
    enabled: isAuthenticated,
    queryFn: async () => {
      const rows = await apiClient.getRecentSearches({ limit: RECENTS_LIMIT });
      return rows.map((r) => mapServerRecentToLocal(r, ownerKey));
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const removeServer = useMutation({
    mutationFn: async (id: string) => apiClient.deleteRecentSearch(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recentSearches"] });
    },
  });

  const clearServer = useMutation({
    mutationFn: async () => apiClient.clearRecentSearches(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recentSearches"] });
    },
  });

  // Unified outputs
  const recent = isAuthenticated ? serverQuery.data ?? [] : localRecent;

  const add = useCallback(
    (input: {
      mode: RecentSearch["mode"];
      searchId?: string | null;
      queryText?: string | null;
      queryImageUrl?: string | null;
    }) => {
      if (isAuthenticated) {
        // DB recents are created by the backend during /search/multimodal.
        // Just refetch.
        qc.invalidateQueries({ queryKey: ["recentSearches"] });
        return;
      }
      addLocal(input);
    },
    [isAuthenticated, qc, addLocal]
  );

  const remove = useCallback(
    (id: string) => {
      if (isAuthenticated) {
        removeServer.mutate(id);
        return;
      }
      removeLocal(id);
    },
    [isAuthenticated, removeLocal, removeServer]
  );

  const clear = useCallback(() => {
    if (isAuthenticated) {
      clearServer.mutate();
      return;
    }
    clearLocal();
  }, [isAuthenticated, clearLocal, clearServer]);

  return {
    ownerKey,
    recent,
    add,
    remove,
    clear,
    isServerBacked: isAuthenticated,
    isLoading: isAuthenticated ? serverQuery.isLoading : false,
  };
}
