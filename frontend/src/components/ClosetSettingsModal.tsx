import React, { useEffect, useMemo, useState } from "react";
import { X, Globe2, Lock, Copy, RefreshCw, Trash2, User as UserIcon } from "lucide-react";
import type { Closet } from "../utils/api";
import {
  useRegenerateClosetTokens,
  useRemoveCollaborator,
  useUpdateCollaboratorRole,
} from "../hooks/closets";

interface ClosetSettingsModalProps {
  open: boolean;
  onClose: () => void;
  closet: Closet;

  onSave: (payload: { name: string; description: string | null }) => Promise<void> | void;
  saving?: boolean;

  onDelete: () => Promise<void> | void;
  deleting?: boolean;
}

const ACCENT = "#213A53";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-[#213A53] focus:border-[#213A53] " +
  "transition-colors";

const ClosetSettingsModal: React.FC<ClosetSettingsModalProps> = ({
  open,
  onClose,
  closet,
  onSave,
  saving = false,
  onDelete,
  deleting = false,
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "share">("general");

  // General Form
  const [name, setName] = useState(closet.name);
  const [description, setDescription] = useState(closet.description ?? "");
  const [confirmText, setConfirmText] = useState("");

  // Sync when opening or closet updates
  useEffect(() => {
    if (open) {
      setName(closet.name);
      setDescription(closet.description ?? "");
      setConfirmText("");
      // Reset tab if needed, or keep last used? Let's reset to general
      // actually keeping last used is nice if they close/reopen
    }
  }, [open, closet]);

  // Actions
  const regenerateTokens = useRegenerateClosetTokens();
  const removeCollaborator = useRemoveCollaborator();
  const updateRole = useUpdateCollaboratorRole();

  const trimmedName = useMemo(() => name.trim(), [name]);
  const canSave = trimmedName.length > 0 && !saving && !deleting;

  const isOwner = closet.role === "owner";

  // Helpers
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast here
  };

  const getShareLink = (token: string) => {
    const origin = window.location.origin;
    return `${origin}/join/${token}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Center */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-[520px] max-w-[95vw] rounded-lg bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-0 border-b border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Settings</h3>
                <p className="text-xs text-gray-500 mt-1">{closet.name}</p>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
                aria-label="Close"
                disabled={saving || deleting}
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab("general")}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "general"
                  ? "border-[#213A53] text-[#213A53]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab("share")}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "share"
                  ? "border-[#213A53] text-[#213A53]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                Share
              </button>
            </div>
          </div>

          {/* Body (Scrollable) */}
          <div className="p-5 overflow-y-auto">
            {activeTab === "general" && (
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Winter Fits"
                    disabled={saving || deleting || !isOwner}
                    maxLength={128}
                  />
                  {!isOwner && <p className="text-xs text-gray-500 mt-1">Only owners can edit details.</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputClass + " min-h-[88px] resize-none"}
                    placeholder="Optional — add a short note about this closet."
                    disabled={saving || deleting || !isOwner}
                    maxLength={500}
                  />
                </div>

                {/* Danger zone (Owner only) */}
                {isOwner && (
                  <div className="pt-2">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-semibold text-red-700 mb-1">Danger zone</p>
                      <p className="text-xs text-red-700/80 mb-3">
                        Deleting a closet removes it and all saved items inside it.
                      </p>

                      <div className="space-y-2">
                        <input
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          className={
                            "w-full rounded-lg border border-red-200 px-3 py-2 text-sm " +
                            "focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-colors"
                          }
                          placeholder='Type "DELETE" to confirm'
                          disabled={saving || deleting}
                        />

                        <button
                          onClick={() => onDelete()}
                          className="w-full rounded-lg bg-red-600 text-white py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          disabled={confirmText !== "DELETE" || saving || deleting}
                          type="button"
                        >
                          {deleting ? "Deleting..." : "Delete closet"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Buttons */}
                {isOwner && (
                  <div className="pt-2">
                    <button
                      onClick={() =>
                        onSave({
                          name: trimmedName,
                          description: description.trim() || null,
                        })
                      }
                      className="w-full rounded-lg text-white py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ backgroundColor: ACCENT }}
                      disabled={!canSave}
                      type="button"
                    >
                      {saving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "share" && (
              <div className="space-y-6">
                {!isOwner ? (
                  <div className="text-center py-8 text-gray-500">
                    <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Only the owner can manage sharing settings.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">Share with others</h4>
                      <button
                        onClick={() => regenerateTokens.mutate(closet.id)}
                        disabled={regenerateTokens.isPending}
                        className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${regenerateTokens.isPending ? "animate-spin" : ""}`} />
                        Reset links
                      </button>
                    </div>

                    {/* View Link */}
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                          <Globe2 className="w-3.5 h-3.5" />
                          Viewer Link
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Read Only</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-gray-600 bg-white border border-gray-200 px-2 py-1.5 rounded flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {closet.view_token ? getShareLink(closet.view_token) : "No link active"}
                        </code>
                        <button
                          onClick={() => closet.view_token && copyToClipboard(getShareLink(closet.view_token))}
                          className="p-1.5 text-gray-500 hover:text-gray-900 transition"
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1.5">
                        Anyone with this link can view this closet.
                      </p>
                    </div>

                    {/* Edit Link */}
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5" />
                          Editor Link
                        </span>
                        <span className="text-[10px] text-purple-600 font-medium uppercase tracking-wider">Can Edit</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-gray-600 bg-white border border-gray-200 px-2 py-1.5 rounded flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {closet.edit_token ? getShareLink(closet.edit_token) : "No link active"}
                        </code>
                        <button
                          onClick={() => closet.edit_token && copyToClipboard(getShareLink(closet.edit_token))}
                          className="p-1.5 text-gray-500 hover:text-gray-900 transition"
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1.5">
                        Anyone with this link can add/remove items.
                      </p>
                    </div>
                  </div>
                )}

                {/* Collaborators List - Visible to EVERYONE */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Collaborators</h4>
                  {(!closet.collaborators || closet.collaborators.length === 0) ? (
                    <p className="text-sm text-gray-500 italic">No direct collaborators yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {/* Show Owner First */}
                      {closet.owner && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 overflow-hidden">
                              {closet.owner.profile_picture_url ? (
                                <img src={closet.owner.profile_picture_url} alt={closet.owner.name || "Owner"} className="w-full h-full object-cover" />
                              ) : (
                                (closet.owner.name?.[0] || "O").toUpperCase()
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {closet.owner.name ?? `User ${closet.owner.id}`} <span className="text-xs text-gray-400 font-normal">(Owner)</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {closet.collaborators.map((c) => (
                        <div key={c.user_id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 overflow-hidden">
                              {c.profile_picture_url ? (
                                <img
                                  src={c.profile_picture_url}
                                  alt={c.username || "Collaborator"}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                c.username?.[0]?.toUpperCase() ?? "U"
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {c.username ?? `User ${c.user_id}`}
                              </span>
                              {isOwner && c.email && (
                                <span className="text-xs text-gray-500">{c.email}</span>
                              )}
                            </div>
                          </div>

                          {isOwner ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={c.role}
                                onChange={(e) =>
                                  updateRole.mutate({
                                    closetId: closet.id,
                                    userId: c.user_id,
                                    role: e.target.value as "viewer" | "editor",
                                  })
                                }
                                disabled={updateRole.isPending}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-[#213A53]"
                              >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                              </select>
                              <button
                                onClick={() => removeCollaborator.mutate({ closetId: closet.id, userId: c.user_id })}
                                disabled={removeCollaborator.isPending}
                                className="p-1 text-gray-400 hover:text-red-600 transition"
                                title="Remove collaborator"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 capitalize px-2 py-1 bg-gray-100 rounded">
                              {c.role}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
};

export default ClosetSettingsModal;

