import React, { useState, useEffect, useRef } from "react";
import { Plus, ArrowUp, History, X, Search as SearchIcon } from "lucide-react";
import brandMarker from "../../assets/images/colored_logo_marker.png";
import type { RecentSearchItem } from "../FloatingSearchBar";

type ChatbotSidebarProps = {
  searchParams: URLSearchParams;
  refineText: string;
  setRefineText: (s: string) => void;
  submitRefine: () => void;
  clearSearchMode: () => void;
  recentSearches: RecentSearchItem[];
  onSelectRecent: (item: RecentSearchItem) => void;
  onClearRecent: () => void;
  onRemoveRecent: (id: string) => void;
  isSearching: boolean;
};

const ChatbotSidebar: React.FC<ChatbotSidebarProps> = ({
  searchParams,
  refineText,
  setRefineText,
  submitRefine,
  clearSearchMode,
  recentSearches,
  onSelectRecent,
  onClearRecent,
  onRemoveRecent,
  isSearching,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // The first user message is the current search.
  const currentSearchTerm = searchParams.get("search")?.trim() || "Image search";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (refineText.trim()) {
        submitRefine();
      }
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentSearchTerm, isSearching]);

  const HistoryView = () => (
    <div className="flex flex-col h-full bg-white absolute inset-0 z-10 transition-transform">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white">
        <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Recent Searches</h2>
        <button
          onClick={() => setShowHistory(false)}
          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-2 pb-6 px-2 space-y-0.5">
        {recentSearches.length === 0 ? (
          <p className="text-gray-400 text-xs text-center mt-10">No recent searches yet.</p>
        ) : (
          <>
            {recentSearches.map((r) => {
              const text = (r.queryText || "").trim();
              const isImageOnly = !text && !!r.queryImageUrl;
              const label = text ? text : isImageOnly ? "Image search" : "Search";

              return (
                <div
                  key={r.id}
                  className="group flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors relative"
                  onClick={() => {
                    setShowHistory(false);
                    onSelectRecent(r);
                  }}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {r.queryImageUrl ? (
                      <img
                        src={r.queryImageUrl}
                        alt=""
                        className="h-6 w-6 rounded flex-shrink-0 object-cover border border-gray-200"
                      />
                    ) : (
                      <SearchIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-sm text-gray-700 font-medium truncate group-hover:text-gray-900 transition-colors">
                        {label}
                      </div>
                    </div>
                  </div>

                  <button
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-white transition-all flex-shrink-0 bg-gray-100 group-hover:shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRecent(r.id);
                    }}
                    title="Delete search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            <div className="px-3 pt-4 mt-2 border-t border-gray-100 w-full flex justify-center">
              <button
                onClick={onClearRecent}
                className="text-xs font-medium text-gray-400 hover:text-gray-900 transition-colors"
              >
                Clear history
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white relative overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white z-20">
        <div className="font-semibold text-gray-900">Agent Search</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-full transition-colors ${showHistory ? 'bg-gray-100 text-black' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
            title="Toggle History"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            onClick={clearSearchMode}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 hover:border-gray-300 hover:text-black hover:bg-gray-50 rounded-full transition-colors"
            title="New Search"
          >
            <Plus className="w-4 h-4" />
            <span>New Search</span>
          </button>
        </div>
      </div>

      {showHistory && <HistoryView />}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto bg-white p-5 space-y-6">
        {/* User Bubble */}
        <div className="flex justify-end">
          <div className="bg-[#213A53] text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm">
            <p className="text-sm leading-relaxed">{currentSearchTerm}</p>
          </div>
        </div>

        {/* AI Bubble */}
        <div className="flex justify-start items-end gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-black flex items-center justify-center shrink-0 border border-gray-200 overflow-hidden">
            <img src={brandMarker} alt="AI" className="w-[120%] h-[120%] object-contain scale-[1.3] brightness-0 invert" />
          </div>
          <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%] shadow-sm">
            <p className="text-sm text-gray-800 leading-relaxed">
              {isSearching ? (
                <span className="flex items-center gap-2">
                  <span className="animate-pulse">Searching...</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  </span>
                </span>
              ) : (
                "Here are the best results I found for you based on your request. Feel free to refine your search below!"
              )}
            </p>
          </div>
        </div>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-5 bg-white shrink-0 relative z-20">
        <div className="relative">
          {/* Ambient Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-transparent via-[#213A53]/5 to-[#213A53]/20 rounded-[30px] blur-xl opacity-70 pointer-events-none"></div>
          
          <div className="bg-white ring-1 ring-black/5 rounded-[24px] shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] relative transition-shadow hover:shadow-[0_4px_25px_-8px_rgba(0,0,0,0.15)] focus-within:shadow-[0_0_30px_rgba(33,58,83,0.15)] flex flex-col justify-end">
          <div className="flex items-center min-h-[50px] px-2 py-1">
            <textarea
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Refine: Try 'more date night', 'warmer tones'..."
              className="flex-1 resize-none bg-transparent py-3 pl-4 pr-2 text-[15px] font-light tracking-tight text-gray-900 outline-none leading-[1.35] max-h-32 placeholder:text-gray-400"
              rows={1}
              style={{
                height: Math.max(48, refineText.split("\n").length * 20 + 28) + "px",
              }}
            />
            <div className="pr-1 pl-2 flex shrink-0">
              <button
                type="button"
                onClick={submitRefine}
                disabled={!refineText.trim() || isSearching}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  refineText.trim() && !isSearching
                    ? "bg-[#213A53] hover:bg-[#42596D] text-white"
                    : "bg-[#213A53]/10 text-black/20 cursor-not-allowed"
                }`}
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotSidebar;
