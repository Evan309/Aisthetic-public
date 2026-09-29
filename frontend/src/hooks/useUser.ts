import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/api";
import { useAuth0 } from "@auth0/auth0-react";

export function useUser() {
    const { isAuthenticated, isLoading, user } = useAuth0();

    return useQuery({
        queryKey: ["me", user?.sub ?? "anon"],
        queryFn: () => apiClient.getMe(),
        enabled: !isLoading && isAuthenticated,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

