import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ProductCard from "../components/ProductCard";
import { useCuratedCloset, useCuratedClosetItems } from "../hooks/closets";

const PAGE_SIZE = 48;

const CuratedClosetDetailPage: React.FC = () => {
  const { curatedClosetId } = useParams<{ curatedClosetId: string }>();

  const curatedIdNum = useMemo(() => {
    const n = Number(curatedClosetId);
    return Number.isFinite(n) ? n : undefined;
  }, [curatedClosetId]);

  const {
    data: closet,
    isLoading: closetLoading,
    error: closetErr,
  } = useCuratedCloset(curatedIdNum);

  // NOTE: this should be infinite/pagination later; for now fetch page 1
  const {
    data: itemsResp,
    isLoading: itemsLoading,
    error: itemsErr,
    refetch,
  } = useCuratedClosetItems(curatedIdNum, 1, PAGE_SIZE);

  const loading = closetLoading || itemsLoading;

  if (!curatedIdNum) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="text-red-500 mb-4">Curated closet not found.</p>
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="text-gray-500">Loading curated closet...</p>
      </div>
    );
  }

  if (closetErr || !closet) {
    return (
      <div className="container mx-auto px-4 py-10">
        <p className="text-red-500 mb-4">
          {closetErr instanceof Error
            ? closetErr.message
            : "Curated closet not found."}
        </p>
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>
      </div>
    );
  }

  // ✅ backend returns { products: [...] }
  const products = itemsResp?.products ?? [];
  const totalProducts = itemsResp?.total_products ?? 0;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-3 mb-6">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">{closet.title}</h1>
          {closet.description ? (
            <p className="mt-2 text-gray-600 text-sm max-w-2xl">
              {closet.description}
            </p>
          ) : null}
        </div>

        <div className="text-sm text-gray-500">
          {totalProducts} item{totalProducts === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold">Items</h2>

          {/* optional quick refresh while iterating */}
          <button
            onClick={() => refetch()}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Refresh
          </button>
        </div>

        {itemsErr ? (
          <p className="text-sm text-red-500">
            {itemsErr instanceof Error
              ? itemsErr.message
              : "Failed to load items."}
          </p>
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-500">No items found.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {products.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* If you want load-more next, switch hook to useInfiniteQuery.
            Your backend already provides: has_more + page + page_size. */}
      </div>
    </div>
  );
};

export default CuratedClosetDetailPage;
