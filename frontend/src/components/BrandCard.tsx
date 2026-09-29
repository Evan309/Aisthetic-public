import React from "react";
import { Link } from "react-router-dom";
import type { BrandWithImage } from "../types";
import fallbackImage from "../assets/images/aisthetic_logo_v0.1.png";

interface BrandCardProps {
    brand: BrandWithImage;
}

const BrandCard: React.FC<BrandCardProps> = ({ brand }) => {
    return (
        <Link
            to={`/brands/${brand.id}`}
            className="relative w-full h-full rounded-md overflow-hidden group"
        >
            <img
                src={brand.image || fallbackImage}
                alt={brand.name}
                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
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

            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-all duration-300"></div>

            <div className="absolute inset-0 flex items-center justify-center">
                <h2 className="text-white text-xs sm:text-sm lg:text-base font-semibold tracking-wide drop-shadow text-center px-1">
                    {brand.name}
                </h2>
            </div>
        </Link>

    );
};




export default BrandCard;
