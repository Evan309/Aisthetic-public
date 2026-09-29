import React, { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

export interface Product {
    id: string;
    name: string;
    brand: string;
    price: number;
    originalPrice?: number;
    image: string;
    affiliateLink?: string; // Add this field
}

interface ProductCardProps {
    product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Generic Amazon link if specific one isn't provided
    const amazonLink = product.affiliateLink || `https://www.amazon.com/s?k=${encodeURIComponent(product.name + " " + product.brand)}`;

    const hasDiscount =
        product.originalPrice && product.price && product.originalPrice > product.price;

    return (
        <motion.a
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-50px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            href={amazonLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white overflow-hidden group cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
                <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-contain bg-white group-hover:scale-105 transition-transform duration-700 ease-out"
                />

                {/* Hover Overlay - Gradient & Info */}
                <div
                    className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-5 flex flex-col justify-end transition-all duration-300 ${isHovered ? "opacity-100" : "opacity-0"
                        }`}
                >
                    <div className={`transform transition-transform duration-300 ${isHovered ? "translate-y-0" : "translate-y-4"}`}>

                        <div className="flex justify-between items-start mb-1">
                            <div className="text-xs font-semibold tracking-wider text-gray-300 uppercase mb-1">
                                {product.brand}
                            </div>
                            <ArrowUpRight className="text-white opacity-0 group-hover:opacity-100 transition-opacity delay-100 w-4 h-4" />
                        </div>

                        <h3 className="font-display text-lg text-white leading-tight mb-2 line-clamp-2">
                            {product.name}
                        </h3>

                        <div className="flex items-center gap-3">
                            <span className="text-white font-medium">
                                ${product.price?.toFixed(2)}
                            </span>
                            {hasDiscount && (
                                <span className="text-gray-400 text-sm line-through">
                                    ${product.originalPrice!.toFixed(2)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.a>
    );
};

export default ProductCard;
