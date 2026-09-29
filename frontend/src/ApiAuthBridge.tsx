import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiClient } from "./utils/api";
import { logger } from "./utils/logger";
import { queryClient } from "./queryClient";

export default function ApiAuthBridge() {
  const { getAccessTokenSilently, isLoading, isAuthenticated, user } = useAuth0();
  const lastUserSubRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    apiClient.setTokenGetter(async () => {
      if (!isAuthenticated) return null;

      try {
        return await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          },
        });
      } catch (err: any) {
        logger.error("[ApiAuthBridge] getAccessTokenSilently failed", err);
        return null;
      }
    });
  }, [isLoading, isAuthenticated, getAccessTokenSilently]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    apiClient.getMe().then(
      (me) => logger.log("[ApiAuthBridge] /users/me OK", me),
      (err) => logger.error("[ApiAuthBridge] /users/me FAIL", err)
    );
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    const currentSub = isAuthenticated ? user?.sub ?? null : null;
    const lastSub = lastUserSubRef.current;

    if (lastSub && lastSub !== currentSub) {
      queryClient.clear();
    } else if (!currentSub && lastSub) {
      queryClient.clear();
    }

    lastUserSubRef.current = currentSub;
  }, [isLoading, isAuthenticated, user?.sub]);

  return null;
}
