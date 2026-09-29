import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api";

export const BRAND_KEYS = {
    all: ["brands"] as const,
    lists: () => [...BRAND_KEYS.all, "list"] as const,
    list: (page: number, limit: number) => [...BRAND_KEYS.lists(), { page, limit }] as const,
    details: () => [...BRAND_KEYS.all, "detail"] as const,
    detail: (id: number) => [...BRAND_KEYS.details(), id] as const,
    featured: (limit: number) => [...BRAND_KEYS.all, "featured", { limit }] as const,
};

export function useBrand(id: number | null) {
    return useQuery({
        queryKey: BRAND_KEYS.detail(id!),
        queryFn: () => apiClient.getBrand(id!),
        enabled: !!id,
        staleTime: 1000 * 60 * 60, // 1 hour (brands barely change)
    });
}

export function useBrands(page = 1, limit = 50) {
    return useQuery({
        queryKey: BRAND_KEYS.list(page, limit),
        queryFn: () => apiClient.getBrands(page, limit),
        staleTime: 1000 * 60 * 60,
    });
}

// Special hook for homepage
export function useFeaturedBrands(limit = 6) {
    // We can just use the regular list endpoint if backend supports sorting by product count,
    // OR use a dedicated endpoint if we made one.
    // We verified backend has `GET /brands/featured` ?
    // Let's check `brands.py` again. yes, `get_featured_brands` exists at `/brands/featured`.
    // Does `api.ts` have `getFeaturedBrands`?
    // Checking `api.ts`... `getBrands` supports page/limit.
    // Wait, `brands.py` has `@router.get("/featured")`.
    // But `api.ts` `getBrands` only calls `/brands`.
    // I might need to add `getFeaturedBrands` to `api.ts` or just use `/brands` with sort params if that covers it and `getFeaturedBrands` isn't exposed in `ApiClient`.

    // Let's check `api.ts` content I just viewed.
    // `getBrands(page, limit)` -> `/brands`.
    // It does NOT have `getFeaturedBrands`.

    // Backend `get_featured_brands` endpoint is `/brands/featured`.
    // I should add `getFeaturedBrands` to `api.ts` first!
    // OR I can use `useQuery` with a custom fetcher here if I don't want to touch `api.ts` again, but that's messy.

    // Better to add `getFeaturedBrands` to `api.ts`.
    return useQuery({
        queryKey: BRAND_KEYS.featured(limit),
        queryFn: async () => {
            // Temporary manual fetch if api.ts is missing it, or better:
            // refer to `apiClient` if I update it.
            // I will assume I update `api.ts` in next step or use direct fetch here?
            // No, I should update `api.ts` to be clean.
            // For now, I'll comment this out or use a direct `fetch` workaround via `apiClient.request` if accessed (but `request` is private).
            // Actually, `getBrands` in `brands.py` allow sorting?
            // `get_brands` allows `sort_by`.
            // The `get_featured_brands` endpoint does special logic (top brands by product count).
            // The `get_brands` endpoint sorts by name or id.

            // I will add `getFeaturedBrands` to `api.ts` before finishing this hook file.
            // So I will write this file assuming `apiClient.getFeaturedBrands(limit)` exists.
            return apiClient.getFeaturedBrands(limit);
        },
        staleTime: 1000 * 60 * 60,
    });
}
