// frontend/src/pages/AccountsPage.tsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronRight, Clock, Search, X } from "lucide-react";

import { apiClient } from "../utils/api";
import { useMyClosetsSummary } from "../hooks/closets";
import ClosetsCard from "../components/ClosetsCard";
import UserAvatar from "../components/UserAvatar";
import { useRecentSearches } from "../hooks/search";
import type { BrandWithImage as ApiBrandWithImage } from "../utils/api";
import { useUser } from "../hooks/useUser";
import { queryClient } from "../queryClient";


const ACCENT = "#213A53";

type UiBrand = {
  id: string;
  name: string;
  image_url?: string | null;
  productCount?: number | null;
};

// api.ts BrandWithImage often uses id:number, UI sometimes expects string
function toUiBrand(b: ApiBrandWithImage): UiBrand {
  return { ...b, id: String((b as any).id) } as UiBrand;
}

// Fetch ALL brands (paginate) — same approach as BrandsPage
async function fetchAllBrands(): Promise<UiBrand[]> {
  const limit = 200;
  let page = 1;

  const first = await apiClient.getBrands(page, limit);
  const all: UiBrand[] = (first.brands || []).map(toUiBrand);
  const totalPages = first.total_pages || 1;

  for (page = 2; page <= totalPages; page++) {
    const res = await apiClient.getBrands(page, limit);
    all.push(...(res.brands || []).map(toUiBrand));
  }

  return all;
}

function formatRelative(ts: string) {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (Number.isNaN(s)) return "";
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function modeLabel(mode: "text" | "image" | "multimodal") {
  if (mode === "multimodal") return "Text + Image";
  if (mode === "image") return "Image";
  return "Text";
}

const AccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, loginWithRedirect, logout } = useAuth0();
  const authUserSub = user?.sub ?? "anon";

  const canUsePersonal = useMemo(
    () => !authLoading && isAuthenticated,
    [authLoading, isAuthenticated]
  );

  const requireLogin = async () => {
    await loginWithRedirect({
      appState: { returnTo: "/account" },
      authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
    });
  };

  // -------------------------
  // Closets preview
  // -------------------------
  const { data: myClosetsData, isLoading: myClosetsLoading } = useMyClosetsSummary(canUsePersonal);
  const myClosets = myClosetsData ?? [];

  const closetsPreview = useMemo(() => myClosets.slice(0, 6), [myClosets]);

  // -------------------------
  // Favorites (IDs + brands)
  // -------------------------
  const favIdsQuery = useQuery({
    queryKey: ["favorite-brand-ids", authUserSub],
    enabled: canUsePersonal,
    queryFn: () => apiClient.getMyFavoriteBrandIds(),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const allBrandsQuery = useQuery({
    queryKey: ["brands", "all"],
    queryFn: fetchAllBrands,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const favoriteBrands = useMemo(() => {
    const ids = new Set((favIdsQuery.data?.brand_ids ?? []).map((x: any) => String(x)));
    const all = allBrandsQuery.data ?? [];
    return all.filter((b) => ids.has(String(b.id)));
  }, [favIdsQuery.data, allBrandsQuery.data]);

  // -------------------------
  // Recent searches (history)
  // -------------------------
  const {
    ownerKey,
    recent: recentSearches,
    remove: removeRecentSearch,
    clear: clearRecentSearches,
    isServerBacked,
    isLoading: recentLoading,
  } = useRecentSearches();

  const [historyExpanded, setHistoryExpanded] = useState(false);

  // If server-backed, fetch all recents when expanded (so View all truly shows all)
  const allHistoryQuery = useQuery({
    queryKey: ["recentSearches", ownerKey, "all"],
    enabled: canUsePersonal && historyExpanded,
    queryFn: async () => {
      const fn = (apiClient as any).getRecentSearches;

      let res: any;
      try {
        // common signature: getRecentSearches({ limit })
        res = await fn({ limit: 200 });
      } catch {
        // alternate signature: getRecentSearches(limit)
        res = await fn(200);
      }

      // normalize: API might return array OR { rows } OR { recent_searches }
      const rows: any[] = Array.isArray(res)
        ? res
        : (res?.recent_searches ?? res?.rows ?? []);

      return rows.map((r: any) => ({
        id: String(r.id),
        mode: r.mode as "text" | "image" | "multimodal",
        searchId: r.search_id ?? null,
        queryText: r.query_text ?? null,
        queryImageUrl: r.query_image_url ?? null,
        createdAt: r.created_at,
      }));
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });


  const historyList = useMemo(() => {
    const base =
      isServerBacked && historyExpanded
        ? (allHistoryQuery.data?.length ? allHistoryQuery.data : recentSearches)
        : recentSearches;

    if (historyExpanded) return base;
    return base.slice(0, 10);
  }, [isServerBacked, historyExpanded, allHistoryQuery.data, recentSearches]);


  const hasMoreHistory = useMemo(() => {
    if (historyExpanded) return false;
    // if signed in, “recentSearches” is limited by hook; still allow view all
    return recentSearches.length > 10 || (canUsePersonal && recentSearches.length >= 10);
  }, [historyExpanded, recentSearches.length, canUsePersonal]);

  const onClickHistoryItem = async (item: {
    searchId?: string | null;
    queryText?: string | null;
  }) => {
    const text = (item.queryText || "").trim();

    if (item.searchId) {
      const params = new URLSearchParams();
      params.set("sid", item.searchId);
      if (text) params.set("search", text);
      navigate(`/products?${params.toString()}`);
      return;
    }

    if (text) {
      const res = await apiClient.searchMultimodalCached({ query_text: text, page_size: 50 });
      const params = new URLSearchParams();
      params.set("sid", res.search_id);
      params.set("search", text);
      navigate(`/products?${params.toString()}`);
    }
  };

  // -------------------------
  // User Data & Edit Modal
  // -------------------------
  const { data: dbUser } = useUser();


  const effectiveAvatar = dbUser?.profile_picture_url || user?.picture || null;
  const effectiveName = dbUser?.name || user?.name || "Guest";
  const effectiveEmail = dbUser?.email || user?.email || "Sign in to view account details";

  // -------------------------
  // UI helpers
  // -------------------------
  const SectionShell: React.FC<{
    title: string;
    right?: React.ReactNode;
    children: React.ReactNode;
  }> = ({ title, right, children }) => (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        {right}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-5">{children}</div>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold">Account</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your profile, closets, favorite brands, and search history.
            </p>
          </div>

          {!canUsePersonal && (
            <button
              onClick={requireLogin}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
              style={{ backgroundColor: ACCENT }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#112233")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
            >
              Sign in
            </button>
          )}
        </div>

        {/* Profile card */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                  {effectiveAvatar ? (
                    <UserAvatar className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-400">
                      <Camera size={18} />
                    </div>
                  )}
                </div>


              </div>

              <div className="min-w-0">
                <div className="text-lg font-semibold text-gray-900 truncate">
                  {effectiveName}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {effectiveEmail}
                </div>


              </div>
            </div>

            <div className="sm:ml-auto flex items-center gap-2">
              {canUsePersonal ? (
                <div className="text-sm text-gray-500">
                  {user?.sub ? "Signed in" : "Signed in"}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Not signed in</div>
              )}
            </div>
          </div>
        </div>



        {/* Closets */}
        <SectionShell
          title="Your Closets"
          right={
            canUsePersonal ? (
              <Link
                to="/closets"
                className="inline-flex items-center gap-1 text-sm font-semibold"
                style={{ color: ACCENT }}
              >
                View all <ChevronRight size={16} />
              </Link>
            ) : null
          }
        >
          {!canUsePersonal ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Create your own closets</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
                Save outfits, organize pieces by vibe, and build collections you can come back to anytime.
              </p>
              <button
                onClick={requireLogin}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
                style={{ backgroundColor: ACCENT }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#112233")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
              >
                Sign in
              </button>
            </div>
          ) : myClosetsLoading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : myClosets.length === 0 ? (
            // same empty feel as ClosetsPage
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No closets yet</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Start your first closet to save outfits and organize your aesthetic.
              </p>
              <div className="mt-5">
                <Link
                  to="/closets"
                  className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
                  style={{ backgroundColor: ACCENT }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#112233")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
                >
                  Go to closets
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {closetsPreview.map((closet) => (
                <ClosetsCard
                  key={closet.id}
                  id={closet.id}
                  name={closet.name}
                  itemCount={closet.item_count}
                  shared={closet.role !== "owner"}
                  images={closet.thumb_urls}
                  to={`/closets/${closet.id}`}
                  owner={closet.owner}
                  collaborators={closet.collaborators}
                />
              ))}
            </div>
          )}
        </SectionShell>

        {/* Favorite brands */}
        <SectionShell
          title="Favorite Brands"
          right={
            canUsePersonal ? (
              <Link
                to="/brands"
                className="inline-flex items-center gap-1 text-sm font-semibold"
                style={{ color: ACCENT }}
              >
                Browse brands <ChevronRight size={16} />
              </Link>
            ) : null
          }
        >
          {!canUsePersonal ? (
            <div className="text-sm text-gray-600">
              Sign in to favorite brands and see them here.
            </div>
          ) : favIdsQuery.isLoading || allBrandsQuery.isLoading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : favoriteBrands.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No favorite brands yet</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Tap the heart on a brand to save it for quick access.
              </p>
              <div className="mt-5">
                <Link
                  to="/brands"
                  className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
                  style={{ backgroundColor: ACCENT }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#112233")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
                >
                  Explore brands
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {favoriteBrands.slice(0, 18).map((b) => (
                <div
                  key={b.id}
                  className="min-w-[180px] max-w-[220px] rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-sm transition"
                >
                  <div className="h-28 bg-gray-100">
                    {b.image_url ? (
                      <img src={b.image_url} alt={b.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400">
                        <Search size={18} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold text-gray-900 truncate">{b.name}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {(b.productCount ?? null) != null ? `${b.productCount} items` : "Saved"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        {/* Search history */}
        <SectionShell
          title="Search History"
          right={
            (canUsePersonal || recentSearches.length > 0) ? (
              <div className="flex items-center gap-2">
                {(canUsePersonal || recentSearches.length > 0) && (
                  <button
                    type="button"
                    onClick={() => clearRecentSearches()}
                    className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            ) : null
          }
        >
          {!canUsePersonal && recentSearches.length === 0 ? (
            <div className="text-sm text-gray-600">
              Your recent searches will show up here.
            </div>
          ) : recentLoading || (historyExpanded && isServerBacked && allHistoryQuery.isLoading) ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : historyList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No searches yet</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Try searching for a vibe, item, or screenshot — we’ll keep a history here.
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {historyList.map((r) => (
                  <div key={r.id} className="py-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600">
                      <Clock size={16} />
                    </div>

                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() => onClickHistoryItem(r)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {r.queryText?.trim()
                            ? r.queryText
                            : r.mode === "image"
                              ? "Image search"
                              : r.mode === "multimodal"
                                ? "Text + image search"
                                : "Search"}
                        </div>
                        <span className="text-xs text-gray-500">
                          • {modeLabel(r.mode)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">{formatRelative(r.createdAt)}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => removeRecentSearch(r.id)}
                      className="h-9 w-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition"
                      aria-label="Remove search"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {hasMoreHistory && (
                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setHistoryExpanded(true)}
                    className="text-sm font-semibold hover:underline"
                    style={{ color: ACCENT }}
                  >
                    View all
                  </button>
                </div>
              )}

              {historyExpanded && (
                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setHistoryExpanded(false)}
                    className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition"
                  >
                    Show less
                  </button>
                </div>
              )}
            </>
          )}
        </SectionShell>
        {/* Danger Zone */}
        {canUsePersonal && (
          <SectionShell title="Danger Zone">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                <p className="text-sm text-gray-600 max-w-md mt-1">
                  Permanently delete your account and all of your content (closets, history, favorites). This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
                    apiClient.deleteAccount().then(() => {
                      queryClient.clear();
                      logout({ logoutParams: { returnTo: window.location.origin } });
                    }).catch((err) => {
                      alert("Failed to delete account: " + err.message);
                    });
                  }
                }}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition"
              >
                Delete Account
              </button>
            </div>
          </SectionShell>
        )}
      </div>

    </div>
  );
};

export default AccountsPage;
