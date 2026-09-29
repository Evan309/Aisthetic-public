import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Bookmark } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import type { Product } from "../types";
import SaveToClosetModal from "../components/SaveToClosetModal";
import { SignInToAccessModal } from "./AuthButtons";
import fallbackImage from "../assets/images/aisthetic_logo_v0.1.png";

interface ProductCardProps {
  product: Product;
  viewMode?: "grid" | "list";
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode = "grid" }) => {
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveHover, setSaveHover] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // anchor rect for popover positioning
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const saveBtnRef = useRef<HTMLButtonElement | null>(null);

  const { isAuthenticated, isLoading: authLoading } = useAuth0();

  const hasDiscount = product.originalPrice && product.price && product.originalPrice > product.price;

  const openSavePopover = () => {
    const el = saveBtnRef.current;
    if (!el) return;
    setAnchorRect(el.getBoundingClientRect());
    setSaveOpen(true);
  };

  // keep popover aligned on scroll/resize while open
  useEffect(() => {
    if (!saveOpen) return;

    const update = () => {
      const el = saveBtnRef.current;
      if (!el) return;
      setAnchorRect(el.getBoundingClientRect());
    };

    update();

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [saveOpen]);

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (authLoading) return;

    if (!isAuthenticated) {
      setGateOpen(true);
      return;
    }

    openSavePopover();
  };

  const SaveButton = useMemo(() => {
    return (
      <button
        ref={saveBtnRef}
        onClick={handleSaveClick}
        onMouseEnter={() => setSaveHover(true)}
        onMouseLeave={() => setSaveHover(false)}
        className={`
          absolute top-3 right-3 z-10
          h-9
          rounded-full
          shadow-sm
          transition-all duration-200 ease-out
          overflow-hidden

          ${saveHover
            ? "w-[92px] px-4 bg-[#213A53] text-white border border-transparent flex items-center justify-center"
            : "w-9 bg-white/95 text-gray-900 border border-gray-200 grid place-items-center"
          }
        `}
        aria-label="Save"
      >
        {!saveHover && !saveOpen ? (
          <Bookmark className="w-4 h-4 block" />
        ) : (
          <span className="text-sm font-semibold whitespace-nowrap">Save</span>
        )}
      </button>
    );
  }, [handleSaveClick, saveHover]);

  if (viewMode === "list") {
    return (
      <>
        <div className="bg-white shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
          <div className="flex">
            <div className="w-48 h-64 bg-white flex-shrink-0">
              <img
                src={product.images?.[0] || product.image || fallbackImage}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== fallbackImage) {
                    target.src = fallbackImage;
                    target.onerror = null;
                    target.classList.remove("object-cover");
                    target.classList.add("object-contain", "p-4");
                  }
                }}
              />
            </div>

            <div className="flex-1 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
                  {product.brand && <p className="text-gray-600 text-sm mb-2">{product.brand}</p>}
                  {product.rating && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-medium">{product.rating}</span>
                        {product.reviewCount && (
                          <span className="text-sm text-gray-500">({product.reviewCount})</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-black">
                    ${product.price?.toFixed(2) || "N/A"}
                  </div>
                  {hasDiscount && (
                    <div className="text-sm text-gray-500 line-through">
                      ${product.originalPrice!.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  ref={saveBtnRef}
                  onClick={handleSaveClick}
                  onMouseEnter={() => setSaveHover(true)}
                  onMouseLeave={() => setSaveHover(false)}
                  className={`
                    flex items-center h-9 rounded-full border border-gray-200 bg-white
                    shadow-sm transition-all duration-200 ease-out
                    ${saveHover || saveOpen ? "w-[92px] px-4 gap-2" : "w-9 px-0 justify-center"}
                  `}
                  aria-label="Save"
                >
                  <Bookmark className="w-4 h-4 shrink-0" />
                  <span
                    className={`
                      text-sm font-semibold whitespace-nowrap transition-all duration-150
                      ${saveHover || saveOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"}
                    `}
                  >
                    Save
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <SaveToClosetModal
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          productId={product.id}
          anchorRect={anchorRect}
        />

        <SignInToAccessModal
          open={gateOpen}
          onClose={() => setGateOpen(false)}
          reason="save"
        />
      </>
    );
  }

  // grid mode
  const rawProduct = product as Product & { product_id?: number; variant_id?: number | null };
  const resolvedProductId = rawProduct.productId ?? rawProduct.product_id ?? product.id;
  const resolvedVariantId = rawProduct.variantId ?? rawProduct.variant_id ?? null;
  const productHref =
    resolvedVariantId != null
      ? `/products/${resolvedProductId}?variantId=${resolvedVariantId}`
      : `/products/${resolvedProductId}`;

  return (
    <>
      <div className="bg-white shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300">
        <div className="relative">
          <Link to={productHref}>
            <div className="aspect-[3/4] bg-white overflow-hidden">
              <img
                src={product.images?.[0] || product.image || fallbackImage}
                alt={product.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== fallbackImage) {
                    target.src = fallbackImage;
                    target.onerror = null;
                    target.classList.remove("object-cover");
                    target.classList.add("object-contain", "p-4");
                  }
                }}
              />
            </div>
          </Link>

          {SaveButton}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{product.brand}</h3>
              <p className="text-sm text-gray-600 line-clamp-1">{product.name}</p>
            </div>
            <div className="text-right flex flex-col items-end ml-3">
              <span className="text-lg font-semibold text-black">
                ${product.price?.toFixed(2) || "N/A"}
              </span>
              {hasDiscount && (
                <span className="text-sm text-gray-500 line-through">
                  ${product.originalPrice!.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <SaveToClosetModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        productId={product.id}
        anchorRect={anchorRect}
      />

      <SignInToAccessModal
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        reason="save"
      />
    </>
  );
};

export default ProductCard;
