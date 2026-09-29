import React, { useEffect } from "react";
import { X } from "lucide-react";
import type { CreateClosetPayload } from "../utils/api";

interface CreateClosetModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateClosetPayload) => Promise<void>;
  isSubmitting?: boolean;
  error?: string | null;
}

const CreateClosetModal: React.FC<CreateClosetModalProps> = ({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
  error,
}) => {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  // Close on ESC
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
    });

    // reset local form on success
    setName("");
    setDescription("");
  };

  return (
    <div className="fixed inset-0 z-[2000]">
      {/* Backdrop (click outside) */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Centered modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-[380px] max-w-[90vw] rounded-lg bg-white shadow-2xl border border-gray-200 overflow-hidden"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header (match SaveToClosetModal) */}
          <div className="px-5 pt-5 pb-3 border-b border-gray-200 flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Create</h3>
              <p className="text-xs text-gray-500 mt-1">New closet</p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Close"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5">
            {error ? <div className="mb-3 text-sm text-red-500">{error}</div> : null}

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Closet name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="
                  w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none
                  focus:ring-2
                  focus:ring-[#213A53]
                  focus:border-[#213A53]
                  transition-colors
                "
                required
                autoFocus
              />

              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="
                  w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none
                  focus:ring-2
                  focus:ring-[#213A53]
                  focus:border-[#213A53]
                  transition-colors
                "
              />

              {/* Actions (kept thin + consistent) */}
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="w-full rounded-lg text-white py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#213A53" }}
              >
                {isSubmitting ? "Creating..." : "Create"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateClosetModal;
