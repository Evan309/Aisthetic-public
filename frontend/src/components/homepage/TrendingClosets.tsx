import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useCuratedClosetsSummary } from "../../hooks/closets";

const TrendingClosets: React.FC = () => {
  const { data, isLoading } = useCuratedClosetsSummary(1, 10, true);
  const closets = data?.closets ?? [];

  return (
    <section className="w-full max-w-[1200px] mx-auto px-6 py-20">
      <div className="flex justify-between items-end mb-10">
        <h2 className="text-3xl md:text-4xl font-display font-medium text-[#000000]">
          Trending Closets
        </h2>
        <Link to="/closets" className="text-[#213A53] font-medium hover:underline text-[15px] pb-1">
          View all &rarr;
        </Link>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
      ) : (
        <div className="columns-2 lg:columns-4 gap-6 space-y-6">
          {closets.map((closet) => {
            const imgUrl = closet.hero_image_url || closet.thumb_urls?.[0];
            return (
              <motion.div
                key={closet.id}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                style={{ transformOrigin: "center bottom" }} // slightly better pop effect for masonry
                className="relative break-inside-avoid rounded-2xl overflow-hidden shadow-sm hover:shadow-xl cursor-pointer group"
              >
                <Link to={`/curated-closets/${closet.id}`} className="block relative w-full h-full">
                  {imgUrl ? (
                    <img 
                      src={imgUrl} 
                      alt={closet.title} 
                      className="w-full h-auto object-cover" 
                      loading="lazy" 
                    />
                  ) : (
                    <div className="w-full aspect-[4/5] bg-gray-100" />
                  )}
                  
                  {/* Bottom Gradient overlay mixing #000000 and #213A53 */}
                  <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#000000]/80 via-[#213A53]/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

                  {/* Text Container */}
                  <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col justify-end pointer-events-none">
                    <span className="text-white/80 text-[11px] uppercase tracking-wider font-semibold mb-1">
                      AI curated
                    </span>
                    <h3 className="text-[#FFFFFF] text-lg font-medium leading-snug drop-shadow-md">
                      {closet.title}
                    </h3>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TrendingClosets;
