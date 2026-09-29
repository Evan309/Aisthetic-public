import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient, type ProductQueryParams, convertApiProduct } from "../utils/api";

export const PRODUCT_KEYS = {
    all: ["products"] as const,
    lists: () => [...PRODUCT_KEYS.all, "list"] as const,
    list: (params: ProductQueryParams) => [...PRODUCT_KEYS.lists(), params] as const,
    details: () => [...PRODUCT_KEYS.all, "detail"] as const,
    detail: (id: number) => [...PRODUCT_KEYS.details(), id] as const,
};

export function useProducts(params: ProductQueryParams = {}) {
    return useInfiniteQuery({
        queryKey: PRODUCT_KEYS.list(params),
        queryFn: async ({ pageParam = 1 }) => {
            return apiClient.getProducts({ ...params, page: pageParam as number });
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            if (lastPage.page < lastPage.total_pages) {
                return lastPage.page + 1;
            }
            return undefined;
        },
        staleTime: 1000 * 60 * 5, // 5 mins
    });
}

export function useFeaturedProducts(limit = 8) {
    return useQuery({
        queryKey: PRODUCT_KEYS.list({ limit }),
        queryFn: async () => {
            const res = await apiClient.getProducts({ limit });
            return res.products.map(convertApiProduct);
        },
        staleTime: 1000 * 60 * 10,
    });
}

// ... existing useFeaturedProducts

export function useBrandProducts(brandId: number, params: ProductQueryParams = {}) {
    return useInfiniteQuery({
        queryKey: [...PRODUCT_KEYS.list(params), "brand", brandId],
        queryFn: async ({ pageParam = 1 }) => {
            // Use the dedicated brand products endpoint
            return apiClient.getBrandProducts(brandId, { ...params, page: pageParam as number });
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            if (lastPage.page < lastPage.total_pages) {
                return lastPage.page + 1;
            }
            return undefined;
        },
        staleTime: 1000 * 60 * 5,
        enabled: !!brandId,
    });
}

export function useProduct(id: number | null) {
    // ...
    return useQuery({
        queryKey: PRODUCT_KEYS.detail(id!),
        queryFn: () => apiClient.getProduct(id!),
        enabled: !!id,
        staleTime: 1000 * 60 * 60,
    });
}
