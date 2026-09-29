import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, ArrowRight, ChevronRight, ChevronLeft } from "lucide-react";

import clothingImg from "../../assets/images/Home/clothing.jpg";
import shoesImg from "../../assets/images/Home/shoes.jpg";
import accessoriesImg from "../../assets/images/Home/accessories.jpg";

const BASE_CLOSETS = [
  { id: "1", title: "Autumn Layering", excerpt: "Master the art of transitional dressing with lightweight knits.", curator: "AIsthetic Editor", date: "Sep 2026", imageUrl: clothingImg, itemCount: 12 },
  { id: "2", title: "Minimalist Essentials", excerpt: "Clean lines and neutral tones for everyday wear.", curator: "Guest Stylist", date: "Aug 2026", imageUrl: accessoriesImg, itemCount: 8 },
  { id: "3", title: "Urban Streetwear", excerpt: "Elevated basics meeting technical fabrics.", curator: "Core Team", date: "Jul 2026", imageUrl: shoesImg, itemCount: 15 },
  { id: "4", title: "Office Ready", excerpt: "Seamlessly transition from desk to dinner.", curator: "AIsthetic Editor", date: "Jun 2026", imageUrl: clothingImg, itemCount: 10 },
  { id: "5", title: "Vacation Edit", excerpt: "Breathable fabrics and bold prints.", curator: "Guest Stylist", date: "May 2026", imageUrl: shoesImg, itemCount: 22 },
];

const LAYOUTS = [
  { h: "h-[100%]", aspect: "aspect-[4/5]" },
  { h: "h-[85%]", aspect: "aspect-[3/4]" },
  { h: "h-[95%]", aspect: "aspect-square" },
  { h: "h-[90%]", aspect: "aspect-[4/5]" },
  { h: "h-[100%]", aspect: "aspect-[3/4]" },
  { h: "h-[85%]", aspect: "aspect-[4/5]" },
  { h: "h-[95%]", aspect: "aspect-[3/4]" },
  { h: "h-[90%]", aspect: "aspect-square" },
  { h: "h-[100%]", aspect: "aspect-[4/5]" },
  { h: "h-[85%]", aspect: "aspect-[3/4]" },
];

export const MOCK_CLOSETS = Array.from({ length: 10 }).map((_, i) => ({
  ...BASE_CLOSETS[i % 5],
  id: `mock-${i}`,
  layout: LAYOUTS[i]
}));

export const SnapshotClosetCard: React.FC<{ closet: typeof MOCK_CLOSETS[0] }> = ({ closet }) => {
  return (
    <div className="group cursor-pointer flex flex-col w-full h-full">
      <div className="relative overflow-hidden rounded-[4px] bg-gray-100 flex-1 min-h-0">
        <img
          src={closet.imageUrl}
          alt={closet.title}
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
        />
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-gray-900 flex items-center gap-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <Layers size={14} />
          {closet.itemCount}
        </div>
      </div>

      <div className="mt-4 shrink-0">
        <div className="flex items-center gap-3 text-[10px] sm:text-xs font-medium tracking-wider text-gray-500 mb-[6px] uppercase">
          <span className="text-[#213A53]">{closet.curator}</span>
          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
          <span>{closet.date}</span>
        </div>
        <h3 className="font-display text-lg sm:text-xl font-bold text-gray-900 mb-[2px] group-hover:text-[#213A53] transition-colors leading-tight">
          {closet.title}
        </h3>
        <p className="text-gray-500 leading-relaxed max-w-[90%] mb-2 line-clamp-2 text-[11px] sm:text-[13px]">
          {closet.excerpt}
        </p>
        <div className="inline-flex items-center text-[12px] sm:text-[13px] font-medium text-black border-b border-black/20 pb-[2px] group-hover:border-black transition-colors">
          View Closet <ArrowRight size={12} className="ml-1.5" />
        </div>
      </div>
    </div>
  );
};

const EditorialClosets: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 10);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, []);

  const scrollNext = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: window.innerWidth * 0.6, behavior: "smooth" });
    }
  };

  const scrollPrev = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -(window.innerWidth * 0.6), behavior: "smooth" });
    }
  };

  return (
    <section className="relative z-[30] pt-12 pb-6 bg-white w-full border-t border-gray-100 overflow-hidden">
      <div className="w-full pl-4 sm:pl-6 lg:pl-8 max-w-none">
        
        {/* Controls */}
        <div className="flex items-end justify-between pr-4 sm:pr-6 lg:pr-8 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-semibold text-gray-900 leading-[1.05] tracking-tight">
              Curated Closets
            </h2>
          </div>
          <div className="hidden md:flex">
            <button 
              onClick={() => navigate('/closets?tab=browse')}
              className="inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: "#213A53" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#541818")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#213A53")}
            >
              Browse More
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div className="relative w-full">
          {/* Left Arrow */}
          {showLeft && (
            <button 
              onClick={scrollPrev}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-40 p-4 rounded-full bg-white border border-gray-100 shadow-lg text-gray-900 hover:scale-105 transition-transform hidden md:flex"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Right Arrow */}
          {showRight && (
            <button 
              onClick={scrollNext}
              className="absolute right-[2rem] top-1/2 -translate-y-1/2 z-40 p-4 rounded-full bg-white border border-gray-100 shadow-lg text-gray-900 hover:scale-105 transition-transform hidden md:flex"
            >
              <ChevronRight size={24} />
            </button>
          )}

          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex flex-row items-start overflow-x-auto gap-6 sm:gap-8 h-[55vh] min-h-[420px] max-h-[600px] snap-x snap-mandatory pb-8 pr-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {MOCK_CLOSETS.map((closet) => (
              <div 
                key={closet.id} 
                className={`shrink-0 snap-center ${closet.layout.h} ${closet.layout.aspect}`}
              >
                <SnapshotClosetCard closet={closet} />
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default EditorialClosets;
