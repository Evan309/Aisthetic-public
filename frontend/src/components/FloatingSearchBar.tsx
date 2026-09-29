import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon, ArrowUp, X, Search as SearchIcon } from "lucide-react";
import brandMarker from "../assets/images/colored_logo_marker.png";

type SearchBarMode = "original" | "scroll" | "search";

export type RecentSearchItem = {
  id: string;
  mode: "text" | "image" | "multimodal";
  searchId?: string | null;
  queryText?: string | null;
  queryImageUrl?: string | null;
  createdAt: string;
};

interface FloatingSearchBarProps {
  prompt: string;
  setPrompt: (v: string) => void;

  onSubmit: () => void | Promise<void>;

  onImageUpload?: () => void;
  showImageUpload?: boolean;

  uploadedImageUrl?: string | null;
  onRemoveUploadedImage?: () => void;

  clearAfterSubmit?: boolean;

  placeholder?: string;
  topOffset?: number;
  initialMode?: SearchBarMode;
  stayCollapsed?: boolean;

  isSubmitting?: boolean;

  recentSearches?: RecentSearchItem[];
  onSelectRecent?: (item: RecentSearchItem) => void | Promise<void>;
  onClearRecent?: () => void;
  onRemoveRecent?: (id: string) => void;
  heroTheme?: boolean;
  rotatingPlaceholders?: string[];
}

/**
 * Height animation is driven ONLY by max-height.
 * IMPORTANT: For collapse animation to be visible, we must NOT immediately shrink inner content
 * to mini height; otherwise max-height has nothing to clip.
 */
const HEIGHT_ANIM_CLASS =
  "transition-[max-height] duration-300 ease-in-out will-change-[max-height]";


const PLACEHOLDER_PSEUDO_CLASS = "placeholder:text-gray-400 placeholder:opacity-100";

const ANIM_MS = 500;

const FloatingSearchBar: React.FC<FloatingSearchBarProps> = ({
  prompt,
  setPrompt,
  onSubmit,
  onImageUpload,
  showImageUpload = true,

  uploadedImageUrl = null,
  onRemoveUploadedImage,
  clearAfterSubmit = true,

  placeholder = "Describe what you're shopping for…",
  topOffset = 80,
  initialMode = "original",
  stayCollapsed = false,
  isSubmitting = false,

  recentSearches = [],
  onSelectRecent,
  onClearRecent,
  onRemoveRecent,
  heroTheme = false,
  rotatingPlaceholders = [],
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // measurement
  const [parkingY, setParkingY] = useState<number | null>(null);
  const [barWidth, setBarWidth] = useState<number | null>(null);
  const [spacerH, setSpacerH] = useState<number>(0);

  // mode + behavior
  const [mode, setMode] = useState<SearchBarMode>(initialMode);
  const [isFixed, setIsFixed] = useState(initialMode === "scroll");

  // animate flag (ONLY used for height)
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const previousMode = useRef<SearchBarMode>(initialMode);

  // scroll -> original expand trick
  const [miniAtOriginalOnce, setMiniAtOriginalOnce] = useState(false);
  const miniOnceRaf = useRef<number | null>(null);
  const returnExpandGuard = useRef(false);

  // decoupled layout state so collapse anim is visible
  const [miniLayout, setMiniLayout] = useState(initialMode === "scroll");
  const pendingMiniTimeout = useRef<number | null>(null);
  const lastTargetCollapsed = useRef<boolean>(initialMode === "scroll");

  const COLLAPSE_BUFFER = 0;
  const EXPAND_BUFFER = 0;

  const changeMode = (next: SearchBarMode) => {
    const prev = previousMode.current;

    const animatedTransitions = [
      ["original", "scroll"],
      ["scroll", "original"],
      ["scroll", "search"],
      ["search", "scroll"],
      ["original", "search"],
      ["search", "original"],
    ] as const;

    const anim = animatedTransitions.some(([from, to]) => from === prev && to === next);

    setShouldAnimate(anim);
    setMode(next);
    previousMode.current = next;
  };

  // ===== Measure parkingY + width =====
  useEffect(() => {
    const measure = () => {
      if (!rootRef.current || !barRef.current) return;

      const rootRect = rootRef.current.getBoundingClientRect();

      setParkingY(rootRect.top + window.scrollY);
      setBarWidth(rootRect.width);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // ===== card height => spacer =====
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    let raf: number | null = null;
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSpacerH(el.getBoundingClientRect().height));
    });

    setSpacerH(el.getBoundingClientRect().height);
    ro.observe(el);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // ===== SCROLL LOGIC =====
  useEffect(() => {
    if (parkingY == null) return;

    const onScroll = () => {
      if (!barRef.current) return;

      const scrollY = window.scrollY;
      const collapseTrigger = parkingY - topOffset - COLLAPSE_BUFFER;
      const expandTrigger = parkingY - topOffset + EXPAND_BUFFER;

      if (scrollY > collapseTrigger + 16) returnExpandGuard.current = false;

      if (mode !== "search" && !stayCollapsed && scrollY <= expandTrigger) {
        if (mode === "scroll" && !returnExpandGuard.current) {
          returnExpandGuard.current = true;

          changeMode("original");
          setIsFixed(false);

          setMiniAtOriginalOnce(true);
          if (miniOnceRaf.current) cancelAnimationFrame(miniOnceRaf.current);
          miniOnceRaf.current = requestAnimationFrame(() => {
            setMiniAtOriginalOnce(false);
            miniOnceRaf.current = null;
          });
        } else if (mode !== "original") {
          changeMode("original");
          setIsFixed(false);
        }
        return;
      }

      if (stayCollapsed && mode === "scroll") {
        setIsFixed(true);
        return;
      }

      if (mode === "original" && scrollY > collapseTrigger) {
        changeMode("scroll");
        setIsFixed(true);
        return;
      }

      if (mode === "scroll") {
        setIsFixed(true);
        return;
      }

      if (mode === "search") {
        if (scrollY <= expandTrigger) {
          setShouldAnimate(true);
          setIsFixed(false);
          return;
        }

        const rect = barRef.current.getBoundingClientRect();
        if (!isFixed && rect.top <= topOffset + COLLAPSE_BUFFER) setIsFixed(true);
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (miniOnceRaf.current) {
        cancelAnimationFrame(miniOnceRaf.current);
        miniOnceRaf.current = null;
      }
    };
  }, [mode, parkingY, isFixed, topOffset, stayCollapsed]);

  // ===== VISUALS =====
  const isSearch = mode === "search";
  const fixedNow = isFixed || mode === "scroll";

  const targetCollapsed = mode === "scroll" || miniAtOriginalOnce;

  useEffect(() => {
    if (pendingMiniTimeout.current) {
      window.clearTimeout(pendingMiniTimeout.current);
      pendingMiniTimeout.current = null;
    }

    const prevTarget = lastTargetCollapsed.current;
    lastTargetCollapsed.current = targetCollapsed;

    if (!targetCollapsed) {
      setMiniLayout(false);
      return;
    }

    if (targetCollapsed && !prevTarget) {
      setMiniLayout(false);
      pendingMiniTimeout.current = window.setTimeout(() => {
        setMiniLayout(true);
        pendingMiniTimeout.current = null;
      }, ANIM_MS + 50);
      return;
    }

    if (targetCollapsed) setMiniLayout(true);
  }, [targetCollapsed]);

  const onHeightWrapTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "max-height") return;
    if (targetCollapsed) {
      setMiniLayout(true);
      if (pendingMiniTimeout.current) {
        window.clearTimeout(pendingMiniTimeout.current);
        pendingMiniTimeout.current = null;
      }
    }
  };

  const isGlass = heroTheme && mode !== "scroll";

  // ===== ROTATING PLACEHOLDER LOGIC =====
  const [currentPlaceholder, setCurrentPlaceholder] = useState(placeholder);
  const placeholderIdx = useRef(0);

  useEffect(() => {
    if (!isGlass || rotatingPlaceholders.length === 0) {
      setCurrentPlaceholder(placeholder);
      return;
    }

    const interval = setInterval(() => {
      placeholderIdx.current = (placeholderIdx.current + 1) % (rotatingPlaceholders.length + 1);
      if (placeholderIdx.current === 0) {
        setCurrentPlaceholder(placeholder);
      } else {
        setCurrentPlaceholder(rotatingPlaceholders[placeholderIdx.current - 1]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isGlass, placeholder, rotatingPlaceholders]);

  const textClass = isGlass
    ? `font-light tracking-wide text-[16px] sm:text-[18px] text-white ${PLACEHOLDER_PSEUDO_CLASS} leading-[1.35] pl-10`
    : `font-light tracking-tight text-[15px] sm:text-[16px] text-gray-900 ${PLACEHOLDER_PSEUDO_CLASS} leading-[1.35] pl-10`;

  const cardPaddingClass = isGlass
    ? (miniLayout ? "px-5 py-3" : "px-6 py-5")
    : (miniLayout ? "px-4 py-2" : "px-5 py-3");

  const shadowClass = isGlass
    ? (isSearch ? "shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)]" : "shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)]")
    : (isSearch ? "shadow-[0_30px_90px_-20px_rgba(66,89,109,0.85)]" : "shadow-[0_25px_70px_-12px_rgba(66,89,109,0.55)]");

  const heightAnim = shouldAnimate ? HEIGHT_ANIM_CLASS : "transition-none";
  const collapsedMax = "max-h-[40px]";
  const expandedMax = "max-h-[16rem]";

  const BAR_Z = 999;
  const BACKDROP_Z = 200;

  const positionStyle: React.CSSProperties = fixedNow
    ? {
      position: "fixed",
      top: topOffset,
      left: "50%",
      transform: "translateX(-50%)",
      width: barWidth ? `${barWidth}px` : "min(100% - 2rem, 56rem)",
      zIndex: BAR_Z,
      pointerEvents: "auto",
    }
    : {
      position: "relative",
      transform: "none",
      width: barWidth ? `${barWidth}px` : "min(100% - 2rem, 56rem)",
      zIndex: BAR_Z,
      pointerEvents: "auto",
    };

  const applyPostSearchUX = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    changeMode("scroll");
    setIsFixed(true);
  };

  // ===== Exit search helper =====
  const exitSearchMode = () => {
    if (mode !== "search") return;

    if (parkingY == null) {
      changeMode("original");
      setIsFixed(false);
      return;
    }

    const scrollY = window.scrollY;
    const expandTrigger = parkingY - topOffset + EXPAND_BUFFER;

    if (stayCollapsed) {
      changeMode("scroll");
      setIsFixed(true);
      return;
    }

    if (scrollY <= expandTrigger) {
      changeMode("original");
      setIsFixed(false);
    } else {
      changeMode("scroll");
      setIsFixed(true);
    }
  };

  // ✅ Esc exits search mode
  useEffect(() => {
    if (mode !== "search") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exitSearchMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  // ===== ACTIONS =====
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    // Check availability
    const hasInput = (prompt || "").trim().length > 0 || !!uploadedImageUrl;
    if (!hasInput) return;

    try {
      await onSubmit();

      applyPostSearchUX();

      if (clearAfterSubmit) {
        setPrompt("");
        onRemoveUploadedImage?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    isCollapsedVisual: boolean
  ) => {
    if (e.key !== "Enter") return;
    if (!isCollapsedVisual && e.shiftKey) return;
    e.preventDefault();
    void handleSubmit();
  };

  const focusTextareaSoon = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = textAreaRef.current;
        if (!el) return;
        el.focus();
        try {
          const len = el.value?.length ?? 0;
          el.setSelectionRange(len, len);
        } catch { }
      });
    });
  };

  const handleOriginalClick = () => {
    if (mode === "original") {
      changeMode("search");
      setIsFixed(false);
      focusTextareaSoon();
    }
  };

  const handleMiniClick = () => {
    if (mode === "scroll") {
      changeMode("search");
      setIsFixed(true);
      focusTextareaSoon();
    }
  };

  const miniDisplayText = (prompt || "").trim() ? (prompt || "").trim() : currentPlaceholder;
  const hasPrompt = (prompt || "").trim().length > 0;
  const canSearch = hasPrompt || !!uploadedImageUrl;

  const RightButton = ({
    size,
    onClick,
  }: {
    size: "mini" | "full";
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  }) => {
    const isMini = size === "mini";
    const btnClass = isMini ? "w-7 h-7" : "w-11 h-11";
    const iconClass = isMini ? "w-3.5 h-3.5" : "w-5 h-5";

    // Disabled state styles for glass UI vs original
    let bgClass = "";
    if (isGlass) {
      if (isSubmitting) {
        bgClass = "bg-white/20 text-white";
      } else if (!canSearch) {
        bgClass = "bg-white/5 text-white/30 cursor-not-allowed border border-white/10";
      } else {
        bgClass = "bg-white/20 hover:bg-white/30 text-white border border-white/20 transition-colors";
      }
    } else {
      if (isSubmitting) {
        bgClass = "bg-[#213A53]/50 text-white";
      } else if (!canSearch) {
        bgClass = "bg-[#213A53]/30 text-white/50 cursor-not-allowed";
      } else {
        bgClass = "bg-[#213A53] hover:bg-[#42596D] text-white";
      }
    }

    return (
      <button
        type="button"
        disabled={isSubmitting || !canSearch}
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-full ${btnClass} ${bgClass}`}
        title="Search"
        aria-label="Search"
      >
        {isMini ? <SearchIcon className={iconClass} /> : <ArrowUp className={iconClass} />}
      </button>
    );
  };

  const renderSearchBackdrop = () => {
    if (!isSearch) return null;

    return createPortal(
      <div
        className="fixed inset-0"
        style={{ zIndex: BACKDROP_Z }}
        onMouseDownCapture={(e) => {
          const target = e.target as Node;
          if (barRef.current?.contains(target)) return;
          e.preventDefault();
          e.stopPropagation();
          exitSearchMode();
        }}
      />,
      document.body
    );
  };

  const MINI_ROW_H_PX = 40;
  const EXPANDED_TEXTAREA_H = "6.25rem";

  const hasRecents = (recentSearches?.length ?? 0) > 0;

  const renderInlineRecentsRow = () => {
    if (!isSearch) return null;
    if (miniLayout) return null;
    if (!hasRecents) return null;

    const items = recentSearches.slice(0, 12);

    return (
      <div className={isGlass ? "pt-3 pb-3 border-t border-white/10 mt-2" : "pt-2 pb-3 border-t border-gray-100"}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className={isGlass ? "text-[11px] uppercase tracking-[0.2em] text-white/60" : "text-[11px] uppercase tracking-[0.2em] text-gray-500"}>
            Recent searches
          </div>

          {onClearRecent && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearRecent();
              }}
              className={isGlass ? "text-xs text-white/50 hover:text-white transition-colors" : "text-xs text-gray-600 hover:text-black"}
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((r) => {
            const text = (r.queryText || "").trim();
            const isImageOnly = !text && !!r.queryImageUrl;
            const label = text ? text : isImageOnly ? "Image search" : "Search";

            return (
              <div
                key={r.id}
                className="shrink-0 group flex items-center gap-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 px-2.5 py-1.5"
              >
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await onSelectRecent?.(r);
                      applyPostSearchUX();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  {r.queryImageUrl ? (
                    <img
                      src={r.queryImageUrl}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <SearchIcon className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  )}

                  <div className="max-w-[180px]">
                    <div
                      className={`text-sm leading-none truncate ${text ? "text-gray-900" : "text-gray-500"
                        }`}
                    >
                      {label}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{r.mode}</div>
                  </div>
                </button>

                {onRemoveRecent && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRecent(r.id);
                    }}
                    className="ml-1 inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100"
                    title="Remove"
                    aria-label="Remove recent"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const UploadImageButton = () => {
    if (!showImageUpload || !onImageUpload) return <div />;

    const canRemove = !!uploadedImageUrl && !!onRemoveUploadedImage;

    if (!uploadedImageUrl) {
      return (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={(e) => {
            e.stopPropagation();
            onImageUpload();
          }}
          className={isGlass
            ? `w-11 h-11 rounded-full flex items-center justify-center border border-white/10 ${isSubmitting ? "bg-white/5" : "bg-white/10 hover:bg-white/20 transition-colors"}`
            : `w-11 h-11 rounded-full flex items-center justify-center ${isSubmitting ? "bg-gray-200" : "bg-gray-100 hover:bg-gray-200"}`}
          aria-label="Upload image"
          title="Upload image"
        >
          <ImageIcon className={isGlass ? "w-5 h-5 text-white/80" : "w-5 h-5 text-gray-700"} />
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={isSubmitting}
        onClick={(e) => {
          e.stopPropagation();
          onImageUpload();
        }}
        className={`group relative w-11 h-11 rounded-full overflow-hidden border border-gray-200 ${isSubmitting ? "opacity-60" : "hover:brightness-[0.98]"
          }`}
        aria-label="Uploaded image (click to replace)"
        title="Uploaded image (click to replace)"
      >
        <img
          src={uploadedImageUrl}
          alt="Uploaded preview"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />

        {canRemove && (
          <span
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          >
            <span
              className="inline-flex items-center justify-center rounded-full w-8 h-8 bg-black/55 backdrop-blur-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isSubmitting) onRemoveUploadedImage?.();
              }}
              role="button"
              aria-label="Remove image"
              title="Remove image"
            >
              <X className="w-4 h-4 text-white" />
            </span>
          </span>
        )}
      </button>
    );
  };

  return (
    <div ref={rootRef}>
      {renderSearchBackdrop()}

      {fixedNow && <div style={{ height: spacerH }} />}

      <div ref={barRef} className={`mx-auto transition-opacity duration-300 ${isSubmitting ? 'opacity-60' : 'opacity-100'}`} style={positionStyle}>
        <div
          ref={cardRef}
          className={
            isGlass
              ? `bg-white/10 backdrop-blur-[32px] border border-white/20 overflow-hidden rounded-[24px] shadow-2xl ${cardPaddingClass} ${shadowClass} relative`
              : `bg-white ring-1 ring-black/5 overflow-hidden rounded-2xl ${cardPaddingClass} ${shadowClass} relative`
          }
        >
          {/* Brand Marker Icon */}
          <div
            className={`
               absolute w-7 h-7 z-10 select-none pointer-events-none
               ${isGlass
                ? (miniLayout ? 'top-[18px] left-5' : 'top-[22px] left-6')
                : (miniLayout ? 'top-[14px] left-4' : 'top-[14px] left-4')
              }
               transition-opacity duration-300 ${isSubmitting ? 'opacity-50' : 'opacity-100'}
             `}
          >
            <img
              src={brandMarker}
              alt=""
              className={isGlass ? "w-full h-full object-contain scale-[1.7] brightness-0 invert" : "w-full h-full object-contain scale-[1.7]"}
            />
          </div>

          <div
            className={`overflow-hidden ${heightAnim} ${targetCollapsed ? collapsedMax : expandedMax
              }`}
            onTransitionEnd={onHeightWrapTransitionEnd}
            onMouseDown={(e) => {
              if (targetCollapsed) {
                e.preventDefault();
                e.stopPropagation();
                handleMiniClick();
                return;
              }
              if (mode === "original") {
                handleOriginalClick();
              }
            }}
            onClick={targetCollapsed ? handleMiniClick : handleOriginalClick}
          >
            {miniLayout ? (
              <div className="relative" style={{ height: `${MINI_ROW_H_PX}px` }}>
                <div className="absolute inset-0 flex items-center">
                  <div
                    className={`w-full font-light ${isGlass ? "tracking-wide text-[16px] sm:text-[18px]" : "tracking-tight text-[15px] sm:text-[16px]"} leading-[1.35] truncate ${hasPrompt ? (isGlass ? "text-white" : "text-gray-900") : (isGlass ? "text-white/60" : "text-gray-400")} pl-10`}
                    style={{ paddingRight: 44 }}
                  >
                    {miniDisplayText}
                  </div>
                </div>

                <textarea
                  ref={textAreaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, true)}
                  placeholder={currentPlaceholder}
                  className={`w-full outline-none bg-transparent resize-none transition-none ${textClass} opacity-0`}
                  style={{
                    height: `${MINI_ROW_H_PX}px`,
                    minHeight: `${MINI_ROW_H_PX}px`,
                    pointerEvents: "none",
                  }}
                />

                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                  <RightButton
                    size="mini"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSubmit();
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <textarea
                  ref={textAreaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, false)}
                  placeholder={currentPlaceholder}
                  className={`w-full outline-none bg-transparent resize-none transition-none ${textClass} pt-1 ${isGlass ? "placeholder:text-white/60" : "placeholder:text-gray-400"}`}
                  style={{
                    height: EXPANDED_TEXTAREA_H,
                    minHeight: EXPANDED_TEXTAREA_H,
                  }}
                />

                <div className="flex items-end justify-between">
                  <UploadImageButton />

                  <RightButton
                    size="full"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSubmit();
                    }}
                  />
                </div>

                {renderInlineRecentsRow()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingSearchBar;
