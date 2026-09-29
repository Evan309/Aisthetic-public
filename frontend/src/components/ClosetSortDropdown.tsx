import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Check,
} from "lucide-react";
import type { ClosetSortBy } from "../utils/api";

type SortOrder = "asc" | "desc";

const ACCENT = "#213A53";
const RING_STYLE = { "--tw-ring-color": ACCENT } as React.CSSProperties;

const SORT_OPTIONS: Array<{ value: ClosetSortBy; label: string; defaultOrder: SortOrder }> = [
  { value: "recently_updated", label: "Recently updated", defaultOrder: "desc" },
  { value: "created_at", label: "Date created", defaultOrder: "desc" },
  { value: "item_count", label: "# of items", defaultOrder: "desc" },
  { value: "name", label: "Name", defaultOrder: "asc" },
];

function orderLabel(sortBy: ClosetSortBy, order: SortOrder) {
  switch (sortBy) {
    case "recently_updated":
      return order === "desc" ? "Newest" : "Oldest";
    case "created_at":
      return order === "desc" ? "Newest" : "Oldest";
    case "item_count":
      return order === "desc" ? "Most" : "Fewest";
    case "name":
      return order === "asc" ? "A→Z" : "Z→A";
    default:
      return order === "asc" ? "Asc" : "Desc";
  }
}

function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [ref, handler]);
}

export default function ClosetSortDropdown(props: {
  sortBy: ClosetSortBy;
  sortOrder?: SortOrder;
  onChange: (next: { sortBy: ClosetSortBy; sortOrder?: SortOrder }) => void;
  showOrderArrow?: boolean;
}) {
  const { sortBy, sortOrder, onChange, showOrderArrow = true } = props;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(rootRef, () => setOpen(false));

  const current = useMemo(() => {
    return SORT_OPTIONS.find((o) => o.value === sortBy) ?? SORT_OPTIONS[0];
  }, [sortBy]);

  const effectiveOrder: SortOrder = sortOrder ?? current.defaultOrder;

  const OrderIcon = effectiveOrder === "asc" ? ArrowUp : ArrowDown;
  const CaretIcon = open ? ChevronUp : ChevronDown;

  const setSort = (opt: (typeof SORT_OPTIONS)[number]) => {
    if (opt.value === sortBy) {
      const nextOrder: SortOrder = effectiveOrder === "asc" ? "desc" : "asc";
      onChange({ sortBy, sortOrder: nextOrder });
    } else {
      onChange({ sortBy: opt.value, sortOrder: opt.defaultOrder });
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 shadow-sm hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={RING_STYLE}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1">
          <SlidersHorizontal className="h-4 w-4" />
          {showOrderArrow ? <OrderIcon className="h-4 w-4" /> : null}
        </span>

        {/* ✅ Fixed-width label area based on smallest option ("Name") */}
        <span className="hidden md:inline-block w-[6ch] truncate text-gray-800">
          {current.label}
        </span>

        <CaretIcon className="h-4 w-4 text-gray-500" />
      </button>

      {open && (
        <div
          role="menu"
          /* ✅ Anchor below the middle of the button */
          className="absolute left-1/2 -translate-x-1/2 mt-2 w-[260px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl z-[200]"
        >
          <div className="px-4 pt-4 pb-3 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-900">Sort</div>
            <div className="mt-0.5 text-xs text-gray-500">
              {current.label} · {orderLabel(sortBy, effectiveOrder)}
            </div>
          </div>

          <div className="py-2">
            {SORT_OPTIONS.map((opt) => {
              const active = opt.value === sortBy;
              const rightLabel = active
                ? orderLabel(opt.value, effectiveOrder)
                : orderLabel(opt.value, opt.defaultOrder);

              return (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  onClick={() => setSort(opt)}
                  className={[
                    "w-full px-4 py-2.5 text-left text-sm transition",
                    active ? "bg-gray-50" : "hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex items-center gap-2">
                      {active ? (
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-md"
                          style={{ backgroundColor: "rgba(106, 30, 30, 0.08)" }}
                        >
                          <Check className="h-4 w-4" style={{ color: ACCENT }} />
                        </span>
                      ) : (
                        <span className="h-5 w-5" />
                      )}

                      <span className={["truncate", active ? "font-semibold text-gray-900" : "text-gray-900"].join(" ")}>
                        {opt.label}
                      </span>
                    </div>

                    <span className="shrink-0 text-xs text-gray-500">{rightLabel}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-4 pb-4 pt-2 text-[11px] text-gray-500">
            Tip: click the active sort again to flip direction.
          </div>
        </div>
      )}
    </div>
  );
}
