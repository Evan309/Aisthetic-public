import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FloatingSearchBar from "../components/FloatingSearchBar";
import DailyEdit from "../components/homepage/DailyEdit";
import { apiClient } from "../utils/api";
import { useRecentSearches } from "../hooks/search";
import type { RecentSearchItem } from "../components/FloatingSearchBar";
import HeroSection from "../components/homepage/HeroSection";
import EditorialClosets from "../components/homepage/EditorialClosets";

// Helper to resize/compress image for localStorage
async function fileToBase64(file: File, maxSide = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxSide || h > maxSide) {
          if (w > h) {
            h = Math.round(h * (maxSide / w));
            w = maxSide;
          } else {
            w = Math.round(w * (maxSide / h));
            h = maxSide;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  // Search bar state
  const [prompt, setPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recent searches
  const {
    recent: recentSearches,
    add: addRecentSearch,
    remove: removeRecentSearch,
    clear: clearRecentSearches,
    isServerBacked,
  } = useRecentSearches();

  // Search loading state
  const [searchLoading, setSearchLoading] = useState(false);

  const clearSearchInputs = () => {
    setPrompt("");
    setSelectedFile(null);
    setSelectedImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePromptSubmit = async (override?: { queryText?: string; file?: File | null }) => {
    const q = (override?.queryText ?? prompt).trim();
    const file = override?.file !== undefined ? override.file : selectedFile;

    if (!q && !file) return;

    try {
      setSearchLoading(true);

      const res = await apiClient.searchMultimodalCached({
        file: file ?? undefined,
        query_text: q || undefined,
        page_size: 50,
      });

      let imgPreview = file ? selectedImageUrl : null;
      if (file && !isServerBacked) {
        try {
          imgPreview = await fileToBase64(file);
        } catch (err) {
          console.warn("Failed to generate base64 preview", err);
        }
      } else if (file && isServerBacked) {
        imgPreview = selectedImageUrl;
      }

      addRecentSearch({
        mode: file && q ? "multimodal" : file ? "image" : "text",
        searchId: res.search_id,
        queryText: q || null,
        queryImageUrl: imgPreview,
      });

      const params = new URLSearchParams();
      params.set("sid", res.search_id);
      if (q) params.set("search", q);

      navigate(`/products?${params.toString()}`);
      clearSearchInputs();
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setSelectedImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  useEffect(() => {
    return () => {
      if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    };
  }, [selectedImageUrl]);

  const onSelectRecent = async (item: RecentSearchItem) => {
    const text = (item.queryText || "").trim();
    setPrompt(text);

    if (item.searchId) {
      const params = new URLSearchParams();
      params.set("sid", item.searchId);
      if (text) params.set("search", text);
      navigate(`/products?${params.toString()}`);
      return;
    }

    if (!text && item.queryImageUrl) {
      handleUploadClick();
      return;
    }

    setSelectedFile(null);
    setSelectedImageUrl(null);
    await handlePromptSubmit({ queryText: text, file: null });
  };

  return (
    <div className="min-h-screen bg-brand-white flex flex-col">
      {/* ============================== */}
      {/* ⭐ HERO SECTION WITH SEARCH & GRID ⭐ */}
      {/* ============================== */}
      <HeroSection
        searchBar={
          <div className="w-full">
            <FloatingSearchBar
              prompt={prompt}
              setPrompt={setPrompt}
              onSubmit={() => handlePromptSubmit()}
              onImageUpload={handleUploadClick}
              showImageUpload={true}
              placeholder="Describe what you're shopping for..."
              topOffset={80}
              isSubmitting={searchLoading}
              recentSearches={recentSearches}
              onSelectRecent={onSelectRecent}
              onClearRecent={clearRecentSearches}
              onRemoveRecent={removeRecentSearch}
              uploadedImageUrl={selectedImageUrl}
              onRemoveUploadedImage={() => {
                setSelectedFile(null);
                setSelectedImageUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              heroTheme={true}
              rotatingPlaceholders={[
                "Date night", "Summer vacation", "Office casual", "Wedding guest", 
                "Weekend brunch", "Minimalist chic", "Y2K accessories", 
                "Vintage denim", "Quiet luxury", "Streetwear essentials"
              ]}
            />
          </div>
        }
      />

      {/* ============================== */}
      {/* ⭐ EDITORIAL CLOSETS ⭐ */}
      {/* ============================== */}
      <EditorialClosets />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ============================== */}
      {/* ⭐ DAILY EDIT ⭐ */}
      {/* ============================== */}
      <div className="bg-brand-white relative z-20 flex flex-col flex-1">
        <DailyEdit />
      </div>

    </div>
  );
};

export default HomePage;
