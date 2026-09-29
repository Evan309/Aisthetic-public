import React from "react";
import { Link } from "react-router-dom";
import fallbackImage from "../assets/images/aisthetic_logo_v0.1.png";
import UserAvatarStack from "./UserAvatarStack";

interface ClosetsCardProps {
  id?: number;
  name: string;

  // counts
  itemCount?: number;
  outfitCount?: number;

  // status
  shared?: boolean;

  // navigation
  to?: string;
  onClick?: () => void;

  // images for the 3-up thumbnail (top big + 2 small)
  images?: string[]; // pass [img1, img2, img3] (any missing -> blank)

  // ✅ Collaboration
  owner?: {
    id: number;
    name: string | null;
    profile_picture_url?: string | null;
  };
  collaborators?: Array<{
    user_id: number;
    username?: string;
    role: "viewer" | "editor" | "owner";
    profile_picture_url?: string | null;
  }>;

  maxAvatars?: number;
}

const ClosetsCard: React.FC<ClosetsCardProps> = ({
  name,
  itemCount = 0,
  outfitCount = 0,
  to,
  onClick,
  images = [],
  owner,
  collaborators,
  maxAvatars,
}) => {
  const [imgTop, imgBottomLeft, imgBottomRight] = images;

  const cardContent = (
    <>
      {/* Thumbnail */}
      <div className="relative">
        <div className="aspect-[3/4] overflow-hidden">
          {/* 1 big on top, 2 small on bottom */}
          <div className="h-full w-full grid grid-rows-[2fr_1fr] gap-1 bg-white">
            {/* top */}
            <div className="relative overflow-hidden bg-gray-100">
              {imgTop ? (
                <img
                  src={imgTop}
                  alt={name}
                  className="h-full w-full object-cover"
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
              ) : null}
            </div>

            {/* bottom row */}
            <div className="grid grid-cols-2 gap-1">
              <div className="relative overflow-hidden bg-gray-100">
                {imgBottomLeft ? (
                  <img
                    src={imgBottomLeft}
                    alt={name}
                    className="h-full w-full object-cover"
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
                ) : null}
              </div>
              <div className="relative overflow-hidden bg-gray-100">
                {imgBottomRight ? (
                  <img
                    src={imgBottomRight}
                    alt={name}
                    className="h-full w-full object-cover"
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
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Collaborator Avatars (Bottom Right) - Only show if there are actual collaborators */}
        {/* User Avatars - Only show if there are collaborators */}
        {/* User Avatars - Only show if there are collaborators */}
        {collaborators && collaborators.length > 0 && (
          <UserAvatarStack
            owner={owner}
            collaborators={collaborators}
            maxAvatars={maxAvatars ?? 3}
            className="absolute bottom-2 right-2"
          />
        )}
      </div>

      {/* Text */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
          {name}
        </h3>

        {/* Footer counts */}
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
          <span>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>

          {outfitCount > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <span>
                {outfitCount} outfit{outfitCount === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );

  const className =
    "bg-white shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300 group";

  if (to) {
    return (
      <Link to={to} className={className}>
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick} className={`${className} cursor-pointer`}>
        {cardContent}
      </div>
    );
  }

  return <div className={className}>{cardContent}</div>;
};

export default ClosetsCard;
