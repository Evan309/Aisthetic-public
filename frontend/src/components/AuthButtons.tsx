import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { queryClient } from "../queryClient";

const ACCENT = "#213A53";

export type AuthMode = "login" | "signup";
export type FeatureGateReason = "save" | "favorite" | "closets" | "account" | "generic";

// Storage keys (keep consistent everywhere)
const K_RETURN_TO = "aisthetic:returnTo";
const K_SCROLL_Y = "aisthetic:returnScrollY";
const K_RESTORE_SCROLL = "aisthetic:restoreScroll";

/**
 * Capture the user's exact location (route + query + hash) and scroll position.
 * We’ll use this to send them back after Auth0 redirects.
 */
export function captureReturnLocation() {
  try {
    const returnTo =
      window.location.pathname + window.location.search + window.location.hash;

    sessionStorage.setItem(K_RETURN_TO, returnTo);
    sessionStorage.setItem(K_SCROLL_Y, String(window.scrollY || 0));
    // flag: tells the target page to restore scroll when it mounts
    sessionStorage.setItem(K_RESTORE_SCROLL, "1");
  } catch {
    // ignore
  }
}

/**
 * Runs after Auth0 redirects back to your SPA.
 *
 * IMPORTANT: To avoid "home flash", you should set Auth0 redirect_uri to:
 *   `${window.location.origin}/auth/callback`
 * and have that callback route immediately send users to returnTo.
 *
 * If you're still using redirect_uri = origin, this will still work,
 * but you may see the home page briefly depending on render timing.
 */
export function handleAuth0RedirectCallback(appState?: any) {
  try {
    const storedReturnTo = sessionStorage.getItem(K_RETURN_TO);
    const returnTo =
      (appState && typeof appState.returnTo === "string" && appState.returnTo) ||
      storedReturnTo ||
      "/";

    const current =
      window.location.pathname + window.location.search + window.location.hash;

    // Hard-navigate to the intended route so the correct page loads immediately.
    // (If returnTo === current, we can restore scroll here.)
    if (returnTo && returnTo !== current) {
      window.location.replace(returnTo);
      return;
    }

    // If already on target route, attempt immediate scroll restore.
    const rawY = sessionStorage.getItem(K_SCROLL_Y);
    const y = rawY ? Number(rawY) : null;
    if (typeof y === "number" && Number.isFinite(y)) {
      requestAnimationFrame(() =>
        window.scrollTo({ top: y, left: 0, behavior: "auto" })
      );
    }
  } catch {
    // ignore
  }
}

/**
 * Call once on app boot (ideally in App.tsx useEffect) to restore scroll after
 * we navigated to returnTo.
 *
 * Why not only once? Some pages (search/infinite lists) re-render after data loads
 * and can reset scroll — so we retry a few times.
 */
export function restoreScrollIfNeeded() {
  try {
    const should = sessionStorage.getItem(K_RESTORE_SCROLL);
    if (should !== "1") return;

    const rawY = sessionStorage.getItem(K_SCROLL_Y);
    const y = rawY ? Number(rawY) : null;

    // Clear flags early to avoid loops.
    sessionStorage.removeItem(K_RESTORE_SCROLL);
    sessionStorage.removeItem(K_SCROLL_Y);

    if (typeof y !== "number" || !Number.isFinite(y)) return;

    const restore = () => {
      try {
        window.scrollTo({ top: y, left: 0, behavior: "auto" });
      } catch {
        // ignore
      }
    };

    // Multiple retries to outlast list rendering, images, react-query refetch, etc.
    requestAnimationFrame(restore);
    setTimeout(restore, 50);
    setTimeout(restore, 200);
    setTimeout(restore, 600);
  } catch {
    // ignore
  }
}

export function useAuthRedirect() {
  const { loginWithRedirect } = useAuth0();

  return async (mode: AuthMode) => {
    captureReturnLocation();

    const returnTo =
      sessionStorage.getItem(K_RETURN_TO) ||
      window.location.pathname + window.location.search + window.location.hash;

    await loginWithRedirect({
      appState: { returnTo },
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        ...(mode === "signup" ? { screen_hint: "signup" } : { prompt: "login" }),
      },
    });
  };
}

/* -------------------------
   Themed Buttons
------------------------- */

function baseBtn(cls: string) {
  return (
    "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold " +
    "transition focus:outline-none focus:ring-2 focus:ring-offset-2 " +
    cls
  );
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  }
) {
  const { className, style, ...rest } = props;
  return (
    <button
      {...rest}
      className={baseBtn("text-white") + (className ? " " + className : "")}
      style={{ backgroundColor: ACCENT, ...style }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#112233";
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = ACCENT;
        props.onMouseLeave?.(e);
      }}
    />
  );
}

export function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  }
) {
  const { className, style, ...rest } = props;
  return (
    <button
      {...rest}
      className={
        baseBtn("border border-gray-300 bg-white text-gray-900 hover:bg-gray-50") +
        (className ? " " + className : "")
      }
      style={style}
    />
  );
}

export function LoginButton(props: { className?: string } = {}) {
  const redirect = useAuthRedirect();
  return (
    <SecondaryButton onClick={() => redirect("login")} className={props.className}>
      Log in
    </SecondaryButton>
  );
}

export function SignupButton(props: { className?: string } = {}) {
  const redirect = useAuthRedirect();
  return (
    <PrimaryButton onClick={() => redirect("signup")} className={props.className}>
      Sign up
    </PrimaryButton>
  );
}

export function LogoutButton(props: { className?: string } = {}) {
  const { logout } = useAuth0();
  return (
    <SecondaryButton
      onClick={() => {
        queryClient.clear();
        logout({ logoutParams: { returnTo: window.location.origin } });
      }}
      className={props.className}
    >
      Log out
    </SecondaryButton>
  );
}

/* -------------------------
   Sign-in gate modal (optional, used by Save/Favorite)
------------------------- */

function reasonCopy(reason: FeatureGateReason) {
  switch (reason) {
    case "save":
      return { title: "Sign in", subtitle: "to save items" };
    case "favorite":
      return { title: "Sign in", subtitle: "to favorite brands" };
    case "closets":
      return { title: "Sign in", subtitle: "to access closets" };
    case "account":
      return { title: "Sign in", subtitle: "to continue" };
    default:
      return { title: "Sign in", subtitle: "to continue" };
  }
}

export function SignInToAccessModal({
  open,
  onClose,
  reason = "generic",
}: {
  open: boolean;
  onClose: () => void;
  reason?: FeatureGateReason;
}) {
  const redirect = useAuthRedirect();
  const { title, subtitle } = useMemo(() => reasonCopy(reason), [reason]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        {/* Match SaveToClosetModal styling */}
        <div className="w-[360px] max-w-[90vw] rounded-lg bg-white shadow-2xl border border-gray-200 overflow-hidden">
          {/* header */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-200 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              {subtitle ? <p className="text-xs text-gray-500 mt-1">{subtitle}</p> : null}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5">
            <div className="flex flex-col gap-2">
              <PrimaryButton
                className="w-full"
                onClick={() => {
                  onClose();
                  redirect("signup");
                }}
              >
                Sign up
              </PrimaryButton>

              <SecondaryButton
                className="w-full"
                onClick={() => {
                  onClose();
                  redirect("login");
                }}
              >
                Log in
              </SecondaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
