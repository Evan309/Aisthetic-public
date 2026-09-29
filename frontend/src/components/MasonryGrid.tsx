import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

// Editorial hero images
import hero1 from '../assets/images/Hero/hero_image_1.jpg';
import hero2 from '../assets/images/Hero/hero_image_2.jpg';
import hero3 from '../assets/images/Hero/hero_image_3.jpg';
import hero4 from '../assets/images/Hero/hero_image_4.jpg';
import hero5 from '../assets/images/Hero/hero_image_5.jpg';
import hero6 from '../assets/images/Hero/hero_image_6.jpg';
import hero7 from '../assets/images/Hero/hero_image_7.jpg';
import hero8 from '../assets/images/Hero/hero_image_8.jpg';
import hero9 from '../assets/images/Hero/hero_image_9.jpg';
import hero10 from '../assets/images/Hero/hero_image_10.jpg';
import hero11 from '../assets/images/Hero/hero_image_11.jpg';
import hero12 from '../assets/images/Hero/hero_image_12.jpg';
import hero13 from '../assets/images/Hero/hero_image_13.jpg';
import hero14 from '../assets/images/Hero/hero_image_14.jpg';
import hero15 from '../assets/images/Hero/hero_image_15.jpg';
import hero16 from '../assets/images/Hero/hero_image_16.jpg';
import hero17 from '../assets/images/Hero/hero_image_17.jpg';
import hero18 from '../assets/images/Hero/hero_image_18.jpg';
import hero19 from '../assets/images/Hero/hero_image_19.jpg';
import hero20 from '../assets/images/Hero/hero_image_20.jpg';

// Using editorial images
const PLACEHOLDER_IMAGES = [
    hero1, hero2, hero3, hero4, hero5, hero6, hero7, hero8, hero9, hero10,
    hero11, hero12, hero13, hero14, hero15, hero16, hero17, hero18, hero19, hero20
];

const MasonryGrid: React.FC = () => {
    // RIGOROUS MATH for Flat Bottom (5 Columns):
    // Offsets (Less Dramatic):
    // - Side: 0px
    // - Mid: 64px (~0.33 W)
    // - Center: 128px (~0.66 W)

    // Column Stacks (Aspect Ratios):
    // STRATEGY: Shorter items (Wide/Square/Standard) + More items per col
    // Avoid "Tall" items like 1/2 or 9/16 to ensure "shorter" feel.
    // Use: Square (1.0), 4/5 (0.8), 3/4 (0.75), 4/3 (0.75 - wait 4/3 is w/h so h is 0.75), 
    // aspect-video (16/9 -> h=0.56)

    const colConfigs = [
        ['aspect-[9/16]', 'aspect-[4/3]', 'aspect-[2/3]', 'aspect-square', 'aspect-[3/4]'],
        ['aspect-video', 'aspect-[3/4]', 'aspect-[4/5]', 'aspect-[9/16]', 'aspect-[3/2]'],
        ['aspect-[3/4]', 'aspect-square', 'aspect-video', 'aspect-[4/5]', 'aspect-[2/3]'],
        ['aspect-[4/5]', 'aspect-[3/2]', 'aspect-[3/4]', 'aspect-square', 'aspect-[9/16]'],
        ['aspect-square', 'aspect-[2/3]', 'aspect-video', 'aspect-[3/4]', 'aspect-[4/3]'],
    ];

    const getColumnContent = (colIdx: number) => {
        const aspects = colConfigs[colIdx];
        return aspects.map((aspect, i) => ({
            id: `${colIdx}-${i}`,
            // Use a deterministic circular index for images to ensure they exist
            front: PLACEHOLDER_IMAGES[(colIdx * 3 + i) % PLACEHOLDER_IMAGES.length],
            back: PLACEHOLDER_IMAGES[(colIdx * 3 + i + 1) % PLACEHOLDER_IMAGES.length],
            aspectClass: aspect
        }));
    };

    const columns = [0, 1, 2, 3, 4].map(i => getColumnContent(i));

    const offsets = [
        "pt-0",
        "pt-0",
        "pt-0",
        "pt-0",
        "pt-0"
    ];

    return (
        <div className="relative w-full">
            {/* Removed max-h constraint to let content flow. Each column is set overflow-hidden and animated upwards */}
            <div className="w-full bg-black flex justify-center gap-2 overflow-hidden items-start h-[150vh]">

                {columns.map((col, colIdx) => (
                    <div
                        key={colIdx}
                        className={`overflow-hidden flex flex-col w-full sm:w-1/2 md:w-1/3 lg:w-1/5 ${offsets[colIdx]} ${colIdx > 1 ? 'hidden md:flex' : ''} ${colIdx > 2 ? 'hidden lg:flex' : ''}`}
                    >
                        <motion.div
                            className="flex flex-col w-full"
                            animate={{ y: ["0%", "-50%"] }}
                            transition={{ duration: 70 + colIdx * 5, repeat: Infinity, repeatType: "loop", ease: "linear" }}
                        >
                            <div className="flex flex-col gap-2 w-full pb-2">
                                {col.map((item) => (
                                    <div key={item.id} className={`relative w-full ${item.aspectClass} group perspective-1000`}>
                                        <MasonryCard frontImage={item.front} backImage={item.back} />
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col gap-2 w-full pb-2">
                                {col.map((item) => (
                                    <div key={`${item.id}-dup`} className={`relative w-full ${item.aspectClass} group perspective-1000`}>
                                        <MasonryCard frontImage={item.front} backImage={item.back} />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                ))}

            </div>
        </div>
    );
};

// Refactor Card to allow parent to control aspect ratio wrapper
const MasonryCard: React.FC<{ frontImage: string; backImage: string }> = ({ frontImage, backImage }) => {
    // const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        /* Temporarily disabled flip animation
        // Randomize start time
        const randomDelay = Math.random() * 2000;
        const flipInterval = 5000;

        // Random flip interval
        const totalInterval = flipInterval + Math.random() * 5000;

        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                setIsFlipped(prev => !prev);
            }, totalInterval);

            return () => clearInterval(interval);
        }, randomDelay);

        return () => clearTimeout(timeout);
        */
    }, []);

    return (
        <div
            className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${
                /* isFlipped ? 'rotate-y-180' : '' */ ''
            }`}
        >
            {/* Front */}
            <div className="absolute inset-0 w-full h-full backface-hidden rounded-lg overflow-hidden shadow-lg">
                <img
                    src={frontImage}
                    alt="Outfit"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/10" />
            </div>

            {/* Back */}
            <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-lg overflow-hidden shadow-lg bg-gray-100">
                <img
                    src={backImage}
                    alt="Outfit Detail"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/10" />
            </div>
        </div>
    );
}

export default MasonryGrid;
