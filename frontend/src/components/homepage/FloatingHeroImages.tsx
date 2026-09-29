import React from 'react';
import { motion } from 'framer-motion';

import hero1 from '../../assets/images/Hero/hero_image_1.jpg';
import hero2 from '../../assets/images/Hero/hero_image_2.jpg';
import hero10 from '../../assets/images/Hero/hero_image_10.jpg';
import hero12 from '../../assets/images/Hero/hero_image_12.jpg';

const FLOATING_IMAGES = [
  // --- Top Left Corner ---
  // Vertical
  { id: 1, src: hero1, className: "w-[9vw] min-w-[90px] max-w-[180px] top-[4%] left-[2%] rotate-[-4deg]", delay: 0.1 },
  // Horizontal
  { id: 2, src: hero10, className: "w-[12vw] min-w-[110px] max-w-[220px] aspect-[4/3] top-[14%] left-[10%] rotate-[5deg] z-10", delay: 0.3 },

  // --- Top Right Corner ---
  // Horizontal
  { id: 3, src: hero12, className: "w-[12vw] min-w-[110px] max-w-[220px] aspect-[4/3] top-[5%] right-[3%] rotate-[3deg]", delay: 0.2 },
  // Vertical
  { id: 4, src: hero2, className: "w-[9vw] min-w-[90px] max-w-[180px] top-[18%] right-[14%] rotate-[-5deg] z-10", delay: 0.4 },
];

const FloatingHeroImages: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {FLOATING_IMAGES.map((img) => (
        <motion.div
          key={img.id}
          className={`absolute ${img.className}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: img.delay, ease: "easeOut" }}
        >
          <motion.div
            animate={{ y: ["0%", "-3%", "0%"] }}
            transition={{
              duration: 8 + img.id * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-full h-full shadow-2xl border border-black/5 flex"
          >
            <img
              src={img.src}
              alt="Hero decorative"
              className="w-full h-full object-cover block"
            />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
};

export default FloatingHeroImages;
