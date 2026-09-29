import React from 'react';

const RECOMMENDED_SEARCHES = [
  "Date night", "Summer vacation", "Office casual", "Wedding guest", "Weekend brunch", 
  "Minimalist chic", "Y2K accessories", "Vintage denim", "Quiet luxury", "Streetwear essentials"
];

// Duplicate for seamless infinite scroll
const loopingSearches = [...RECOMMENDED_SEARCHES, ...RECOMMENDED_SEARCHES];

interface RecommendedSearchCarouselProps {
  onSearchClick: (query: string) => void;
}

const RecommendedSearchCarousel: React.FC<RecommendedSearchCarouselProps> = ({ onSearchClick }) => {
  return (
    <div className="w-full flex justify-center">
      <div className="w-full flex items-center overflow-hidden">
        
        {/* Static Prefix */}
        <div className="shrink-0 text-white font-display tracking-tight text-xl md:text-3xl lg:text-4xl font-medium mr-2 md:mr-4 z-10 relative">
          Search for:
        </div>

        {/* Scrolling Masked Container */}
        <div 
          className="flex-1 overflow-hidden relative"
          style={{ 
            maskImage: 'linear-gradient(to right, black 0%, black 90%, transparent 100%)', 
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black 90%, transparent 100%)' 
          }}
        >
          <style>{`
            @keyframes string-slide {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); } 
            }
            .animate-string-slide {
              animation: string-slide 160s linear infinite;
            }
            .animate-string-slide:hover {
              animation-play-state: paused;
            }
          `}</style>
          
          <div className="flex w-max animate-string-slide gap-6 items-end">
            {loopingSearches.map((text, i) => (
              <div key={i} className="flex items-center shrink-0">
                <button
                  onClick={() => onSearchClick(text)}
                  className="text-white hover:text-white/80 font-display tracking-tight text-xl md:text-3xl lg:text-4xl transition-opacity duration-200 whitespace-nowrap leading-none"
                >
                  {text}
                </button>
                <span className="text-white ml-2 font-display text-xl md:text-3xl lg:text-4xl leading-none">,</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default RecommendedSearchCarousel;

