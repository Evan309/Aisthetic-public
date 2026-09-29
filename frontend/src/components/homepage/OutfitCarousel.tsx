import React from "react";
import clothingImg from "../../assets/images/Home/clothing.jpg";
import shoesImg from "../../assets/images/Home/shoes.jpg";
import accessoriesImg from "../../assets/images/Home/accessories.jpg";

const MOCK_OUTFITS = [
  {
    id: 1,
    title: "Weekend Brunch",
    description: "A breezy, effortless look for Sunday mornings.",
    image: clothingImg,
  },
  {
    id: 2,
    title: "Office Elegance",
    description: "Sharp tailoring meets modern minimalism.",
    image: shoesImg,
  },
  {
    id: 3,
    title: "Night Out",
    description: "Bold textures and sleek silhouettes for the evening.",
    image: accessoriesImg,
  },
  {
    id: 4,
    title: "Casual Friday",
    description: "Relaxed fits with elevated basics.",
    image: clothingImg,
  },
];

const OutfitCarousel: React.FC = () => {
  return (
    <section className="w-full max-w-[1200px] mx-auto px-6 py-16">
      <h2 className="text-3xl md:text-4xl font-display font-medium text-[#000000] mb-10">
        Outfits Built for You
      </h2>

      <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory pt-2 pl-2 -ml-2 scrollbar-hide">
        {MOCK_OUTFITS.map((outfit) => (
          <div
            key={outfit.id}
            className="shrink-0 w-[280px] sm:w-[320px] snap-center bg-[#FFFFFF] border border-[#9BA3AA]/50 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
          >
            {/* Image area */}
            <div className="w-full aspect-[4/5] bg-gray-100 relative overflow-hidden">
              {outfit.image ? (
                <img
                  src={outfit.image}
                  alt={outfit.title}
                  className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-gray-100" />
              )}
            </div>

            {/* Content area */}
            <div className="p-6 flex flex-col flex-grow">
              <h3 className="text-xl font-medium text-[#000000] mb-2">
                {outfit.title}
              </h3>
              <p className="text-[#42596D] text-[15px] font-light mb-6 flex-grow leading-relaxed">
                {outfit.description}
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-3 mt-auto">
                <button className="w-full py-2.5 rounded-full bg-[#213A53] text-[#FFFFFF] font-medium hover:bg-[#1a2e42] hover:shadow-sm transition-all">
                  Shop Outfit
                </button>
                <button className="w-full py-2.5 rounded-full bg-[#FFFFFF] border border-[#9BA3AA]/70 text-[#213A53] font-medium hover:bg-gray-50 hover:border-[#42596D] transition-all">
                  Customize
                </button>
              </div>
            </div>
          </div>
        ))}
        {/* Empty padding element to allow scrolling to the end seamlessly */}
        <div className="shrink-0 w-2 sm:w-6" />
      </div>
    </section>
  );
};

export default OutfitCarousel;
