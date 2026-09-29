// frontend/src/pages/AuthCallback.tsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

const K_RETURN_TO = "aisthetic:returnTo";
const K_SCROLL_Y = "aisthetic:returnScrollY";
const K_RESTORE_SCROLL = "aisthetic:restoreScroll";

function restoreScrollRetries() {
  try {
    const should = sessionStorage.getItem(K_RESTORE_SCROLL);
    if (should !== "1") return;

    const rawY = sessionStorage.getItem(K_SCROLL_Y);
    const y = rawY ? Number(rawY) : null;

    // clear flags early to avoid loops
    sessionStorage.removeItem(K_RESTORE_SCROLL);
    sessionStorage.removeItem(K_SCROLL_Y);

    if (typeof y !== "number" || !Number.isFinite(y)) return;

    const restore = () => {
      try {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      } catch {}
    };

    requestAnimationFrame(restore);
    setTimeout(restore, 50);
    setTimeout(restore, 200);
    setTimeout(restore, 600);
  } catch {
    // ignore
  }
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, error } = useAuth0();
  const didNav = useRef(false);

  useEffect(() => {
    // Wait until Auth0 finishes processing /auth/callback?code=...&state=...
    if (isLoading) return;
    if (didNav.current) return;

    // If authenticated, go to saved returnTo immediately (no "home flash")
    if (isAuthenticated) {
      didNav.current = true;

      const target = sessionStorage.getItem(K_RETURN_TO) || "/";

      // ✅ This triggers React Router navigation properly
      navigate(target, { replace: true });

      // restore scroll after the route renders
      setTimeout(restoreScrollRetries, 0);
      return;
    }

    // If not authenticated after loading, something went wrong (show message)
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-sm text-gray-600">
          Signing you in…
        </div>

        {!isLoading && !isAuthenticated && (
          <div className="mt-3 text-xs text-red-600">
            {error?.message || "Login did not complete. Please try again."}
          </div>
        )}
      </div>
    </div>
  );
}
