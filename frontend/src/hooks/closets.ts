import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  type Closet,
  type ClosetSummary,
  type ClosetSortBy,
  type CreateClosetPayload,
  type UpdateClosetPayload,
  type ClosetItemCard,
  type CachedSearchResponse,
  type CuratedClosetDetail,
  type CuratedClosetItemsResponse
} from "../utils/api";

/**
 * Shared defaults to prevent refetch spam and reduce backend calls.
 * - staleTime: how long data is considered "fresh" (no refetch)
 * - gcTime: how long unused cache stays in memory
 */
const DEFAULT_QUERY_OPTS = {
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  refetchOnWindowFocus: false,
  retry: (count: number, err: any) =>
    err?.message === "UNAUTHORIZED" ? false : count < 2,
};

// Helper: update every cached myClosetsSummary variant (since queryKey includes sort params)
function updateAllMyClosetsSummary(
  qc: ReturnType<typeof useQueryClient>,
  updater: (prev: ClosetSummary[] | undefined) => ClosetSummary[] | undefined
) {
  const entries = qc.getQueriesData<ClosetSummary[]>({ queryKey: ["myClosetsSummary"] });
  entries.forEach(([key, data]) => {
    qc.setQueryData<ClosetSummary[]>(key, updater(data));
  });
}

// -------------------------
// Queries
// -------------------------



/**
 * Summary closets (counts + thumb_urls) — use for Closets page + modals.
 * Much smaller payload than full closets.
 */
export function useMyClosetsSummary(
  enabled: boolean,
  opts?: { sort_by?: ClosetSortBy; sort_order?: "asc" | "desc" }
) {
  return useQuery({
    queryKey: ["myClosetsSummary", opts?.sort_by ?? "recently_updated", opts?.sort_order ?? ""],
    queryFn: () => apiClient.getMyClosetsSummary(opts),
    enabled,
    ...DEFAULT_QUERY_OPTS,
    // ✅ keep the last data while refetching so UI can render the right # of skeletons
    placeholderData: (prev) => prev,
  });
}

/**
 * Closet metadata (name/description/public flag). Light fetch.
 */
export function useCloset(closetId?: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ["closet", closetId],
    queryFn: () => apiClient.getClosetById(closetId!),
    enabled: enabled && !!closetId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: (count: number, err: any) =>
      err?.message === "UNAUTHORIZED" ? false : count < 2,
  });
}

/**
 * Closet item cards for ProductCard grid.
 *   GET /closets/{closetId}/items/cards?limit&offset
 */
export function useClosetItemCards(
  closetId?: number,
  enabled: boolean = true,
  limit: number = 48,
  offset: number = 0
) {
  return useQuery<ClosetItemCard[]>({
    queryKey: ["closetItemCards", closetId, limit, offset],
    queryFn: () => apiClient.getClosetItemCards(closetId!, limit, offset),
    enabled: enabled && !!closetId,
    ...DEFAULT_QUERY_OPTS,
    placeholderData: (prev) => prev, // keeps prior page visible during pagination
  });
}

// -------------------------
// Mutations
// -------------------------

export function useCreateCloset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateClosetPayload) => apiClient.createCloset(payload),

    onSuccess: (created) => {
      // Update SUMMARY caches (all sort variants)
      const createdSummary: ClosetSummary = {
        id: created.id,
        name: created.name,
        description: created.description ?? null,
        slug: created.slug ?? null,
        role: "owner",
        item_count: 0,
        outfit_count: 0,
        thumb_urls: [],
      };

      updateAllMyClosetsSummary(qc, (prev) =>
        prev ? [createdSummary, ...prev] : [createdSummary]
      );

      // No invalidation needed.
    },
  });
}

/**
 * Update closet (name/description)
 * - Optimistic update for instant UI
 * - Updates caches for: closet detail, full list, summary list
 * - No refetch spam
 */
export function useUpdateCloset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      closetId,
      payload,
    }: {
      closetId: number;
      payload: UpdateClosetPayload;
    }) => apiClient.updateCloset(closetId, payload),

    onMutate: async ({ closetId, payload }) => {
      // Cancel ongoing reads that could overwrite optimistic data
      await qc.cancelQueries({ queryKey: ["closet", closetId] });
      await qc.cancelQueries({ queryKey: ["myClosets"] });
      await qc.cancelQueries({ queryKey: ["myClosetsSummary"] });

      const prevCloset = qc.getQueryData<Closet>(["closet", closetId]);
      const prevSummarySnapshots = qc.getQueriesData<ClosetSummary[]>({ queryKey: ["myClosetsSummary"] });

      // Optimistic closet detail
      if (prevCloset) {
        qc.setQueryData<Closet>(["closet", closetId], {
          ...prevCloset,
          ...payload,
        });
      }

      // Optimistic summary list (all sort variants)
      updateAllMyClosetsSummary(qc, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === closetId
            ? {
              ...c,
              name: payload.name ?? c.name,
            }
            : c
        );
      });

      return { prevCloset, prevSummarySnapshots, closetId };
    },

    onError: (_err, _vars, ctx) => {
      // Rollback
      if (!ctx) return;
      if (ctx.prevCloset) qc.setQueryData(["closet", ctx.closetId], ctx.prevCloset);
      ctx.prevSummarySnapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
    },

    onSuccess: (updated) => {
      // Server truth (slug might update, etc.)
      qc.setQueryData(["closet", updated.id], updated);

      updateAllMyClosetsSummary(qc, (old) =>
        old
          ? old.map((c) =>
            c.id === updated.id
              ? {
                ...c,
                name: updated.name,
                slug: updated.slug ?? null,
                role: updated.role ?? c.role,
              }
              : c
          )
          : old
      );
    },
  });
}

/**
 * Delete closet
 * - Removes closet from caches
 * - Removes item cards caches for that closet
 * - No refetch spam
 */
export function useDeleteCloset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (closetId: number) => apiClient.deleteCloset(closetId),

    onMutate: async (closetId) => {
      await qc.cancelQueries({ queryKey: ["closet", closetId] });
      await qc.cancelQueries({ queryKey: ["myClosetsSummary"] });

      const prevCloset = qc.getQueryData<Closet>(["closet", closetId]);
      const prevSummarySnapshots = qc.getQueriesData<ClosetSummary[]>({ queryKey: ["myClosetsSummary"] });

      // Optimistically remove from lists
      updateAllMyClosetsSummary(qc, (old) =>
        old ? old.filter((c) => c.id !== closetId) : old
      );

      // Remove detail + cards caches
      qc.removeQueries({ queryKey: ["closet", closetId] });
      qc.removeQueries({ queryKey: ["closetItemCards", closetId] });

      return { prevCloset, prevSummarySnapshots, closetId };
    },

    onError: (_err, _vars, ctx) => {
      if (!ctx) return;

      // Rollback
      if (ctx.prevCloset) qc.setQueryData(["closet", ctx.closetId], ctx.prevCloset);
      ctx.prevSummarySnapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
    },

    onSuccess: (_res, closetId) => {
      // Ensure they're gone (idempotent)
      qc.removeQueries({ queryKey: ["closet", closetId] });
      qc.removeQueries({ queryKey: ["closetItemCards", closetId] });
    },
  });
}

/**
 * Add item to closet
 * Optimistic update + minimal invalidation
 */
export function useAddItemToCloset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      closetId,
      productId,
      variantId,
    }: {
      closetId: number;
      productId: number;
      variantId?: number | null;
    }) => apiClient.addItemToCloset(closetId, productId, variantId),

    onMutate: async ({ closetId }) => {
      await qc.cancelQueries({ queryKey: ["myClosetsSummary"] });

      const prevSummarySnapshots = qc.getQueriesData<ClosetSummary[]>({ queryKey: ["myClosetsSummary"] });

      // Optimistically bump SUMMARY count across all sort variants
      updateAllMyClosetsSummary(qc, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === closetId ? { ...c, item_count: (c.item_count ?? 0) + 1 } : c
        );
      });

      return { prevSummarySnapshots, closetId };
    },

    onError: (_err, _vars, ctx) => {
      ctx?.prevSummarySnapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
    },

    onSuccess: (_data, vars) => {
      // Refresh summary to update ordering + thumbs
      qc.invalidateQueries({ queryKey: ["myClosetsSummary"] });
      qc.invalidateQueries({ queryKey: ["closetItemCards", vars.closetId] });
      qc.invalidateQueries({ queryKey: ["closetRecommendations", vars.closetId] });
    },
  });
}

export function useRemoveItemFromCloset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ closetId, itemId }: { closetId: number; itemId: number }) =>
      apiClient.removeItemFromCloset(closetId, itemId),

    onMutate: async ({ closetId, itemId }) => {
      // Cancel any in-flight fetches for cards pages of this closet
      await qc.cancelQueries({ queryKey: ["closetItemCards", closetId] });
      await qc.cancelQueries({ queryKey: ["myClosetsSummary"] });

      // Snapshot all cached pages for rollback
      const snapshots = qc.getQueriesData<any[]>({
        queryKey: ["closetItemCards", closetId],
      });

      const prevSummarySnapshots = qc.getQueriesData<ClosetSummary[]>({ queryKey: ["myClosetsSummary"] });

      // Optimistically remove from every cached page we have
      snapshots.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData(key, data.filter((c: any) => c.item_id !== itemId));
      });

      // Optimistically decrement summary count (all variants)
      updateAllMyClosetsSummary(qc, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === closetId
            ? { ...c, item_count: Math.max(0, (c.item_count ?? 0) - 1) }
            : c
        );
      });

      return { snapshots, prevSummarySnapshots, closetId };
    },

    onError: (_err, _vars, ctx) => {
      // Rollback cards pages
      ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
      // Rollback summaries
      ctx?.prevSummarySnapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
      // safest: refetch summary
      qc.invalidateQueries({ queryKey: ["myClosetsSummary"] });
    },

    onSuccess: (_data, vars) => {
      // Refresh summary to update ordering + thumbs accurately
      qc.invalidateQueries({ queryKey: ["myClosetsSummary"] });

      // Refresh cards pages for this closet (in case pagination shifts)
      qc.invalidateQueries({ queryKey: ["closetItemCards", vars.closetId] });
      qc.invalidateQueries({ queryKey: ["closetRecommendations", vars.closetId] });
    },
  });
}

export function useClosetRecommendationsSearch(closetId?: number, enabled = true) {
  return useQuery<CachedSearchResponse>({
    queryKey: ["closetRecommendations", closetId],
    queryFn: () =>
      apiClient.closetRecommendationsCached({
        closet_id: closetId!,
        page_size: 20,
        ttl_minutes: 60,
      }),
    enabled: enabled && !!closetId,
    staleTime: 60 * 60 * 1000,   // 1h: don’t refetch on nav
    gcTime: 2 * 60 * 60 * 1000,  // keep it around
    refetchOnWindowFocus: false,
  });
}

export function useCuratedClosetsSummary(
  page: number = 1,
  limit: number = 12,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["curatedClosetsSummary", page, limit],
    queryFn: () =>
      apiClient.getCuratedClosetsSummary({ page, limit }),
    enabled,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCuratedCloset(curatedClosetId?: number) {
  return useQuery<CuratedClosetDetail>({
    queryKey: ["curatedCloset", curatedClosetId],
    queryFn: () => apiClient.getCuratedClosetById(curatedClosetId!),
    enabled: !!curatedClosetId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCuratedClosetItems(curatedClosetId?: number, page = 1, page_size = 48) {
  return useQuery<CuratedClosetItemsResponse>({
    queryKey: ["curatedClosetItems", curatedClosetId, page, page_size],
    queryFn: () =>
      apiClient.getCuratedClosetItems({
        curated_closet_id: curatedClosetId!,
        page,
        page_size,
      }),
    enabled: !!curatedClosetId,
    staleTime: 10 * 60 * 1000,

    refetchOnWindowFocus: false,
  });
}

export function useRegenerateClosetTokens() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (closetId: number) => apiClient.regenerateClosetTokens(closetId),
    onSuccess: (updated) => {
      qc.setQueryData(["closet", updated.id], updated);
    },
  });
}

export function useRemoveCollaborator() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ closetId, userId }: { closetId: number; userId: number }) =>
      apiClient.removeCollaborator(closetId, userId),
    onSuccess: (_data, vars) => {
      // Invalidate to refresh the list
      qc.invalidateQueries({ queryKey: ["closet", vars.closetId] });
    },
  });
}

export function useUpdateCollaboratorRole() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      closetId,
      userId,
      role,
    }: {
      closetId: number;
      userId: number;
      role: "viewer" | "editor";
    }) => apiClient.updateCollaboratorRole(closetId, userId, role),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["closet", vars.closetId] });
    },
  });
}

export function useJoinCloset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => apiClient.joinCloset(token),
    onSuccess: (closet) => {
      // Refresh lists since we just joined a new closet
      qc.invalidateQueries({ queryKey: ["myClosetsSummary"] });

      // Seed detail cache
      qc.setQueryData(["closet", closet.id], closet);
    },
  });
}

