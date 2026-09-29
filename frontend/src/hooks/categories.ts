import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api";

export const CATEGORY_KEYS = {
    all: ["categories"] as const,
};

export function useCategories() {
    return useQuery({
        queryKey: CATEGORY_KEYS.all,
        queryFn: () => apiClient.getCategories(),
        staleTime: 1000 * 60 * 60 * 24, // 24 hours (rarely changes)
        gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });
}
