import React, { useLayoutEffect, useMemo, useState } from "react";
import { X, Plus, Users } from "lucide-react";
import type { CreateClosetPayload } from "../utils/api";
import { useAddItemToCloset, useCreateCloset, useMyClosetsSummary } from "../hooks/closets";

type Props = {
  open: boolean;
  onClose: () => void;
  productId: number;
  variantId?: number | null;

  // ✅ new: anchor for popover positioning
  anchorRect?: DOMRect | null;
};

const POPOVER_W = 380;
const POPOVER_H = 480;
const GAP_BELOW = 10;
const GAP_ABOVE = 6;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const SaveToClosetModal: React.FC<Props> = ({
  open,
  onClose,
  productId,
  variantId = null,
  anchorRect = null,
}) => {
  const { data: myClosetsData, isLoading: myClosetsLoading, isError: myClosetsError } = useMyClosetsSummary(open);

  // Filter out closets where user is only a viewer
  const myClosets = useMemo(() => {
    return (myClosetsData ?? []).filter((c) => c.role === "owner" || c.role === "editor");
  }, [myClosetsData]);

  const addToClosetMutation = useAddItemToCloset();
  const create = useCreateCloset();

  const [error, setError] = useState<string | null>(null);

  // create closet inline
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const canSubmitCreate = useMemo(
    () => name.trim().length > 0 && !create.isPending,
    [name, create.isPending]
  );

  const savingId = addToClosetMutation.variables?.closetId ?? null;
  const isSavingAny = addToClosetMutation.isPending;

  const saveToCloset = async (closetId: number) => {
    setError(null);
    try {
      await addToClosetMutation.mutateAsync({ closetId, productId, variantId });
      onClose();
    } catch (e) {
      console.error(e);
      setError("Failed to save item. Please try again.");
    }
  };

  const createCloset = async () => {
    if (!canSubmitCreate) return;

    setError(null);

    const payload: CreateClosetPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
    };

    try {
      const created = await create.mutateAsync(payload);

      setShowCreate(false);
      setName("");
      setDescription("");

      await saveToCloset(created.id);
    } catch (e) {
      console.error(e);
      setError("Failed to create closet.");
    }
  };

  // ✅ compute popover position under anchor
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 120, left: 20 });

  useLayoutEffect(() => {
    if (!open) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!anchorRect) {
      // fallback: near top-right
      setPos({ top: 120, left: clamp(vw - POPOVER_W - 20, 12, vw - 12) });
      return;
    }

    // try align right edge of popover to right edge of button
    const desiredLeft = anchorRect.right - POPOVER_W;
    const left = clamp(desiredLeft, 12, vw - POPOVER_W - 12);

    const popoverH = POPOVER_H;

    // below position
    const belowTop = anchorRect.bottom + GAP_BELOW;
    const canFitBelow = belowTop + popoverH < vh - 12;

    // above position (tighter + accurate)
    const aboveTop = anchorRect.top - popoverH - GAP_ABOVE;


    const top = canFitBelow
      ? belowTop
      : clamp(aboveTop, 12, vh - 12);


    setPos({ top, left });
  }, [open, anchorRect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300]">
      {/* click outside */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* popover */}
      <div
        className="absolute"
        style={{ top: pos.top, left: pos.left, width: POPOVER_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-lg bg-white shadow-2xl border border-gray-200 overflow-hidden h-[480px] flex flex-col">
          {/* header */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-200 flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Save</h3>
              <p className="text-xs text-gray-500 mt-1">Choose a closet</p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 flex-1 flex flex-col overflow-hidden">
            {(error || (myClosetsError && "Failed to load your closets.")) && (
              <div className="mb-3 text-sm text-red-500">
                {error ?? "Failed to load your closets."}
              </div>
            )}

            <div className="shrink-0">
              <button
                onClick={() => setShowCreate((v) => !v)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:underline"
              >
                <Plus className="w-4 h-4" />
                Create new closet
              </button>

              {showCreate && (
                <div className="mt-4 mb-4 rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <div className="space-y-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Closet name..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 transition-colors"
                      style={{ "--tw-ring-color": "#213A53" } as React.CSSProperties}
                    />
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 transition-colors"
                      style={{ "--tw-ring-color": "#213A53" } as React.CSSProperties}
                    />

                    <button
                      onClick={createCloset}
                      disabled={!canSubmitCreate}
                      className="w-full rounded-lg text-white py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                      style={{ backgroundColor: "#213A53" }}
                    >
                      {create.isPending ? "Creating..." : "Create & Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* closets list */}
            {myClosetsLoading ? (
              <div className="mt-4 text-sm text-gray-500">Loading your closets…</div>
            ) : myClosets.length === 0 ? (
              <div className="mt-4 text-sm text-gray-500">No closets yet — create one above.</div>
            ) : (
              <div className="mt-4 flex-1 overflow-auto pr-1 space-y-2">
                {myClosets.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => saveToCloset(c.id)}
                    disabled={isSavingAny}
                    className="w-full text-left rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* left */}
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                        {c.description ? (
                          <div className="text-xs text-gray-500 truncate">{c.description}</div>
                        ) : null}
                      </div>

                      {/* right: ✅ privacy icon on right side */}
                      <div className="shrink-0 flex items-center gap-2 text-xs text-gray-600">
                        {c.role && c.role !== "owner" && (
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <Users className="w-4 h-4" />
                            Shared
                          </span>
                        )}
                        {savingId === c.id ? <span>Saving…</span> : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveToClosetModal;
