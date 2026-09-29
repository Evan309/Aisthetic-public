import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useQueryClient } from "@tanstack/react-query";
import { type CreateClosetPayload, type ClosetSortBy } from "../utils/api";
import ClosetsCard from "../components/ClosetsCard";
import ClosetSortDropdown from "../components/ClosetSortDropdown";
import { useCreateCloset, useMyClosetsSummary } from "../hooks/closets";
import CreateClosetModal from "../components/CreateClosetModal";
import { SnapshotClosetCard, MOCK_CLOSETS } from "../components/homepage/EditorialClosets";


const ClosetsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "browse" ? "browse" : "yours";
  const qc = useQueryClient();
  const { isLoading: authLoading, isAuthenticated, loginWithRedirect } = useAuth0();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const canUsePersonal = useMemo(
    () => !authLoading && isAuthenticated,
    [authLoading, isAuthenticated]
  );

  // ✅ Sort state (drives dropdown + query)
  const [sortBy, setSortBy] = useState<ClosetSortBy>("recently_updated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | undefined>(undefined);

  const effectiveSortOrder: "asc" | "desc" =
    sortOrder ?? (sortBy === "name" ? "asc" : "desc");

  // ✅ Sorted closets summary
  const {
    data: myClosetsData,
    isLoading: myLoading,
    isError: myIsError,
  } = useMyClosetsSummary(canUsePersonal, {
    sort_by: sortBy,
    sort_order: effectiveSortOrder,
  });

  const myClosets = myClosetsData ?? [];

  const [lastKnownCount, setLastKnownCount] = useState<number>(6);

  useEffect(() => {
    if (myClosetsData) setLastKnownCount(myClosetsData.length);
  }, [myClosetsData]);

  // ✅ Cache-based skeleton sizing (matches your sorted key)
  const cached = qc.getQueryData<any>(["myClosetsSummary", sortBy, effectiveSortOrder]);
  const cachedCount =
    Array.isArray(cached) ? cached.length :
      Array.isArray((cached as any)?.closets) ? (cached as any).closets.length :
        undefined;

  const skeletonCount =
    (myClosetsData ? myClosetsData.length : 0) ||
    (cachedCount ?? 0) ||
    lastKnownCount ||
    6;

  const createClosetMutation = useCreateCloset();

  const requireLogin = async () => {
    await loginWithRedirect({
      appState: { returnTo: "/closets" },
      authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
    });
  };







  const ClosetCardSkeleton = () => {
    return (
      <div className="bg-white shadow-sm border border-gray-200 overflow-hidden">
        <div className="aspect-[3/4] bg-gray-100 animate-pulse" />
        <div className="p-3">
          <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
          <div className="mt-2 h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  };

  const CreateClosetPlaceholderCard: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group bg-white shadow-sm border border-dashed border-gray-300 overflow-hidden hover:border-gray-400 hover:bg-gray-50 transition text-left"
        aria-label="Create a new closet"
      >
        <div className="aspect-[3/4] bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-gray-700">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gray-300 bg-white text-2xl text-gray-700 group-hover:border-gray-400 transition">
              +
            </div>
            <div className="text-sm font-semibold">Create closet</div>
          </div>
        </div>
        <div className="p-3">
          <div className="h-4 w-2/3 bg-gray-100 rounded group-hover:bg-gray-200 transition" />
          <div className="mt-2 h-3 w-1/2 bg-gray-100 rounded group-hover:bg-gray-200 transition" />
        </div>
      </button>
    );
  };

  return (
    <div className="relative min-h-screen bg-white pb-28">

      <div className="w-full px-4 sm:px-6 lg:px-8 py-10 max-w-none">
        <CreateClosetModal
          open={showCreateForm}
          onClose={() => {
            setShowCreateForm(false);
            setUiError(null);
          }}
          isSubmitting={createClosetMutation.isPending}
          error={uiError}
          onSubmit={async (payload: CreateClosetPayload) => {
            setUiError(null);
            try {
              const created = await createClosetMutation.mutateAsync(payload);
              setShowCreateForm(false);
              navigate(`/closets/${created.id}`);
            } catch (err) {
              console.error(err);
              setUiError("Failed to create closet.");
            }
          }}
        />

        <div className="mb-10 flex border-b border-gray-200">
          <button
            onClick={() => {
              const p = new URLSearchParams(searchParams);
              p.set("tab", "browse");
              setSearchParams(p);
            }}
            className={`pb-4 px-6 text-base font-semibold transition-colors relative ${activeTab === "browse" ? "text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            Browse Closets
            {activeTab === "browse" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
          <button
            onClick={() => {
              const p = new URLSearchParams(searchParams);
              p.set("tab", "yours");
              setSearchParams(p);
            }}
            className={`pb-4 px-6 text-base font-semibold transition-colors relative ${activeTab === "yours" ? "text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            Your Closets
            {activeTab === "yours" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
            )}
          </button>
        </div>

        {activeTab === "yours" && (
        <section>
          {(uiError || myIsError) && (
            <div className="mb-4 text-sm text-red-500">
              {uiError ?? "Failed to load your closets."}
            </div>
          )}

          {/* Header & Controls */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Your Closets</h2>

            <div className="flex items-center gap-2">
              {/* ✅ Custom sort dropdown */}
              {canUsePersonal && (
                <ClosetSortDropdown
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onChange={({ sortBy: nextSortBy, sortOrder: nextSortOrder }) => {
                    setSortBy(nextSortBy);
                    setSortOrder(nextSortOrder);
                  }}
                />
              )}

              {!canUsePersonal ? (
                <button
                  onClick={requireLogin}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition"
                  style={{ backgroundColor: "#213A53" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#541818")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#213A53")}
                >
                  Sign in
                </button>
              ) : (
                <button
                  onClick={() => {
                    setUiError(null);
                    setShowCreateForm(true);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm text-white font-semibold transition-colors"
                  style={{ backgroundColor: "#213A53" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#541818")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#213A53")}
                >
                  Create
                </button>
              )}
            </div>
          </div>

          {(uiError || myIsError) && (
            <div className="mt-2 text-sm text-red-500">
              {uiError ?? "Failed to load your closets."}
            </div>
          )}

          {/* Owned Closets Grid */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-12">
            {authLoading ? (
              <div className="col-span-full text-sm text-gray-500">Loading…</div>
            ) : !isAuthenticated ? (
              <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-16 text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Create your own closets</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
                  Save outfits, organize pieces by vibe, and build collections you can come back to anytime.
                </p>
                <button
                  onClick={requireLogin}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition"
                  style={{ backgroundColor: "#213A53" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#541818")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#213A53")}
                >
                  Sign in
                </button>
              </div>
            ) : myLoading ? (
              Array.from({ length: Math.max(1, skeletonCount) }).map((_, i) => (
                <ClosetCardSkeleton key={i} />
              ))
            ) : myClosets.filter(c => c.role === "owner").length === 0 ? (
              <div
                className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white p-16 text-center cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setShowCreateForm(true)}
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-gray-300 text-2xl text-gray-600 hover:border-gray-400">
                  +
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No closets yet</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto mb-5">
                  Start your first closet to save outfits and organize your aesthetic.
                </p>
              </div>
            ) : (
              <>
                {myClosets.filter(c => c.role === "owner").map((closet) => (
                  <ClosetsCard
                    key={closet.id}
                    id={closet.id}
                    name={closet.name}
                    itemCount={closet.item_count}
                    shared={false}
                    images={closet.thumb_urls}
                    to={`/closets/${closet.id}`}
                    owner={closet.owner}
                    collaborators={closet.collaborators}
                  />
                ))}

                {canUsePersonal && (
                  <CreateClosetPlaceholderCard
                    onClick={() => {
                      setUiError(null);
                      setShowCreateForm(true);
                    }}
                  />
                )}
              </>
            )}
          </div>

          {/* Shared Closets Section */}
          {isAuthenticated && !myLoading && myClosets.some(c => c.role !== "owner") && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Shared with me</h2>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                {myClosets.filter(c => c.role !== "owner").map((closet) => (
                  <ClosetsCard
                    key={closet.id}
                    id={closet.id}
                    name={closet.name}
                    itemCount={closet.item_count}
                    shared={true}
                    images={closet.thumb_urls}
                    to={`/closets/${closet.id}`}
                    owner={closet.owner}
                    collaborators={closet.collaborators}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
        )}

        {activeTab === "browse" && (
        <div className="pb-16">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Explore Closets</h2>
            <p className="mt-1 text-sm text-gray-500">Discover curated collections and find your new aesthetic.</p>
          </div>

          <div className="columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
            {[...MOCK_CLOSETS, ...MOCK_CLOSETS.map(c => ({...c, id: c.id + '-2'})), ...MOCK_CLOSETS.map(c => ({...c, id: c.id + '-3'}))].map(closet => (
              <div key={closet.id} className="break-inside-avoid">
                <div className={`w-full ${closet.layout.aspect}`}>
                  <SnapshotClosetCard closet={closet} />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-12 flex justify-center">
             {/* Simulating infinite scroll loading state */}
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default ClosetsPage;
