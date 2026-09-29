import React, { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient, type ApiProduct } from "../../utils/api";
import ProductCard from "../ProductCard";
import type { Product } from "../../types";

function convertApiProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    image: p.image,
    description: p.description,
    category: p.category,
    brand: p.brand,
    inStock: p.inStock,
    rating: p.rating,
    reviewCount: p.reviewCount,
    tags: p.tags,
  };
}

const DailyEdit: React.FC = () => {
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery({
    queryKey: ["daily-edit-products"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await apiClient.getProducts({
        page: pageParam as number,
        limit: 20,
      });
      return {
        products: res.products.map(convertApiProduct),
        nextPage: res.products.length === 20 ? (pageParam as number) + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });

  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items = data ? data.pages.flatMap(p => p.products) : [];

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-16 bg-white flex-1 flex flex-col items-center">
      <div className="w-full">
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-display font-semibold text-gray-900 mb-8 sm:mb-10 text-center leading-[1.05] tracking-tight">
          The Daily Edit
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        
        {/* Loader / Intersection Observer Target */}
        <div ref={loaderRef} className="w-full py-16 flex justify-center">
          {(isLoading || isFetchingNextPage) && (
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-black" />
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyEdit;
