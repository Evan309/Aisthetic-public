import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import React, { useState, useRef } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import FloatingSearchBar, { type RecentSearchItem } from './FloatingSearchBar';
import { useRecentSearches } from '../hooks/search';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isExcludedPage = location.pathname === "/" || location.pathname.startsWith("/products");

  // Global Search State
  const [prompt, setPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Recents hook
  const {
    recent: recentSearches,
    // add: addRecentSearch, // handled by ProductsPage on mount
    remove: removeRecentSearch,
    clear: clearRecentSearches,
    // isServerBacked,
  } = useRecentSearches();

  const onSelectRecent = (item: RecentSearchItem) => {
    const text = (item.queryText || "").trim();
    if (text) setPrompt(text);

    // If we have a Search ID, go there directly
    if (item.searchId) {
      const params = new URLSearchParams();
      params.set("sid", item.searchId);
      if (text) params.set("search", text);
      navigate(`/products?${params.toString()}`);

      // cleanup global state
      setPrompt("");
      setPreviewUrl(null);
      setSelectedFile(null);
      return;
    }

    // Fallback: If no Search ID (expired?), just run a fresh text search if possible
    if (text) {
      navigate(`/products?search=${encodeURIComponent(text)}`);
      setPrompt("");
      return;
    }

    // If it was purely an image search with no text and no ID, we can't easily redo it 
    // from here without converting the stored image string back to a file. 
    // For now, we'll just ignore or could redirect to plain products.
  };

  const handleGlobalSearch = async () => {
    const q = prompt.trim();
    if (!q && !selectedFile) return;

    // Immediate navigation with state
    navigate('/products', {
      state: {
        globalSearch: {
          queryText: q || undefined,
          file: selectedFile
        }
      }
    });

    // Cleanup local state immediately
    setPrompt("");
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <Navbar />

      {!isExcludedPage && (
        <div className="fixed top-20 left-0 right-0 z-[250] px-6 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <FloatingSearchBar
              prompt={prompt}
              setPrompt={setPrompt}
              onSubmit={handleGlobalSearch}
              onImageUpload={() => fileInputRef.current?.click()}
              showImageUpload={true}
              topOffset={80}
              initialMode="scroll"
              stayCollapsed={true}
              uploadedImageUrl={previewUrl}
              onRemoveUploadedImage={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}

              // ✅ Recent searches
              recentSearches={recentSearches}
              onSelectRecent={onSelectRecent}
              onClearRecent={clearRecentSearches}
              onRemoveRecent={removeRecentSearch}
            />
          </div>
          {/* Hidden Global Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Reduced padding to pt-28, set bg-white to prevent gray body leak */}
      <main className={`flex-1 bg-white ${!isExcludedPage ? "pt-28" : ""}`}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
