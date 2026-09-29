import React from "react";
import { Link } from "react-router-dom";
import fallbackImage from "../assets/images/aisthetic_logo_v0.1.png";

type Props = {
  id: number;
  title: string;
  description?: string | null;
  productCount?: number;
  thumbUrls?: string[]; // up to 3
  heroImageUrl?: string | null;
  to?: string;
};

const CuratedClosetCard: React.FC<Props> = ({
  id,
  title,
  thumbUrls = [],
  heroImageUrl,
  to,
}) => {
  const images = thumbUrls?.length
    ? thumbUrls
    : heroImageUrl
      ? [heroImageUrl]
      : [];

  const [imgLeft, imgTopRight, imgBottomRight] = images;

  const href = to ?? `/curated-closets/${id}`;

  return (
    <Link to={href} className="block">
      <div className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
        {/* Thumbnail: big left + 2 stacked right */}
        <div className="relative grid grid-cols-[2fr_1fr] gap-1 bg-white">
          {/* Big left */}
          <div className="relative aspect-[16/11] bg-gray-100 overflow-hidden">
            {imgLeft ? (
              <img
                src={imgLeft}
                alt={title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
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
            ) : (
              <div className="absolute inset-0 bg-gray-100" />
            )}
          </div>

          {/* Right column: 2 stacked */}
          <div className="grid grid-rows-2 gap-1">
            <div className="relative bg-gray-100 overflow-hidden">
              <div className="aspect-[16/11]" />
              {imgTopRight ? (
                <img
                  src={imgTopRight}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
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
              ) : (
                <div className="absolute inset-0 bg-gray-100" />
              )}
            </div>

            <div className="relative bg-gray-100 overflow-hidden">
              <div className="aspect-[16/11]" />
              {imgBottomRight ? (
                <img
                  src={imgBottomRight}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
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
              ) : (
                <div className="absolute inset-0 bg-gray-100" />
              )}
            </div>
          </div>

          {/* Title overlay (no white bar) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            {/* scrim for readability */}
            <div className="h-14 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2">
              <h3 className="text-[12px] font-semibold text-white line-clamp-2 drop-shadow-sm">
                {title}
              </h3>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default CuratedClosetCard;
