// src/hooks/useImpressionLogger.ts
import { useEffect, useRef } from "react";
import { apiClient } from "../utils/api";

export function useImpressionLogger(sessionId: number | null) {
  const seen = useRef<Set<string>>(new Set());

  // 🔑 IMPORTANT: reset when session changes
  useEffect(() => {
    seen.current.clear();
  }, [sessionId]);

  function markImpression(productId: number, position: number) {
    if (!sessionId) return;

    const key = `${sessionId}:${productId}`;
    if (seen.current.has(key)) return;
    seen.current.add(key);

    apiClient
      .logSearchEvent({
        session_id: sessionId,
        event_type: "impression",
        product_id: productId,
        position,
        impression_key: key,
      })
      .catch(() => {});
  }

  return { markImpression };
}
