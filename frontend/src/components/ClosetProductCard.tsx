import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Trash } from "lucide-react";
import type { Product } from "../types";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import fallbackImage from "../assets/images/aisthetic_logo_v0.1.png";

interface ClosetProductCardProps {
  itemId: number;
  product: Product;
  onRemove: (itemId: number) => void;
  removing?: boolean;
  canRemove?: boolean;
}

const ClosetProductCard: React.FC<ClosetProductCardProps> = ({
  itemId,
  product,
  onRemove,
  removing = false,
  canRemove = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasDiscount =
    product.originalPrice && product.price && product.originalPrice > product.price;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmOpen(true); // ✅ open popup
  };

  const handleConfirm = () => {
    onRemove(itemId);     // ✅ actually remove
    setConfirmOpen(false);
  };

  return (
    <>
      <div
        className="bg-white shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300 group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative">
          <Link to={`/products/${product.id}`}>
            <div className="aspect-[3/4] bg-white overflow-hidden relative">
              <img
                src={product.image || fallbackImage}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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

              <div
                className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 via-black/30 to-transparent p-4 transition-all duration-300 ${isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white mb-1 line-clamp-1">
                      {product.brand}
                    </h3>
                    <p className="text-sm text-gray-200 line-clamp-1">{product.name}</p>
                  </div>
                  <div className="text-right flex flex-col items-end ml-3">
                    <span className="text-lg font-semibold text-white">
                      ${product.price?.toFixed(2) || "N/A"}
                    </span>
                    {hasDiscount && (
                      <span className="text-sm text-gray-300 line-through">
                        ${product.originalPrice!.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Delete Button */}
          {canRemove && (
            <button
              onClick={handleDeleteClick}
              className={`absolute top-3 right-3 p-2 rounded-full transition-all duration-200
                bg-white/80 text-gray-700 hover:bg-white hover:text-red-600
                ${isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
              `}
              aria-label="Delete from closet"
              disabled={removing}
            >
              <Trash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Confirm popup */}
      <ConfirmDeleteModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        loading={removing}
        title="Remove item from closet?"
        message="This will remove the item from this closet. You can always save it again later."
        confirmText="Remove"
      />
    </>
  );
};

export default ClosetProductCard;
