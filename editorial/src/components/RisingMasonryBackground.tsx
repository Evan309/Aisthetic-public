import React from 'react';

// Using placeholders since we don't have local assets yet
const PLACEHOLDER_IMAGES = [
    '/images/Hero/hero_image_1.jpg',
    '/images/Hero/hero_image_2.jpg',
    '/images/Hero/hero_image_3.jpg',
    '/images/Hero/hero_image_4.jpg',
    '/images/Hero/hero_image_5.jpg',
    '/images/Hero/hero_image_6.jpg',
    '/images/Hero/hero_image_7.jpg',
    '/images/Hero/hero_image_8.jpg',
    '/images/Hero/hero_image_9.jpg',
    '/images/Hero/hero_image_10.jpg',
    '/images/Hero/hero_image_11.jpg',
    '/images/Hero/hero_image_12.jpg',
    '/images/Hero/hero_image_13.jpg',
    '/images/Hero/hero_image_14.jpg',
    '/images/Hero/hero_image_15.jpg',
    '/images/Hero/hero_image_16.jpg',
    '/images/Hero/hero_image_17.jpg',
    '/images/Hero/hero_image_18.jpg',
    '/images/Hero/hero_image_19.jpg',
    '/images/Hero/hero_image_20.jpg',
];

const RisingMasonryBackground: React.FC = () => {
    // Column Configuration
    const colConfigs = [
        ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-square', 'aspect-[3/4]', 'aspect-[4/5]'],
        ['aspect-square', 'aspect-[3/4]', 'aspect-[4/5]', 'aspect-[3/4]', 'aspect-square'],
        ['aspect-[4/5]', 'aspect-square', 'aspect-square', 'aspect-[4/5]', 'aspect-[3/4]'],
        ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-[3/4]', 'aspect-square', 'aspect-[4/5]'],
        ['aspect-square', 'aspect-[3/4]', 'aspect-square', 'aspect-[3/4]', 'aspect-[4/5]'],
    ];

    const getColumnContent = (colIdx: number) => {
        const aspects = colConfigs[colIdx];
        // Duplicate content 4 times to ensure enough vertical height for the loop 
        // and to allow the 0% -> -50% translation to work seamlessly.
        // We move from 0% (top of set 1) to -50% (top of set 3). 
        // Since set 3 is identical to set 1, the loop is seamless.
        const multipleAspects = [...aspects, ...aspects, ...aspects, ...aspects];
        return multipleAspects.map((aspect, i) => ({
            id: `${colIdx}-${i}`,
            image: PLACEHOLDER_IMAGES[(colIdx * 2 + i) % PLACEHOLDER_IMAGES.length],
            aspectClass: aspect
        }));
    };

    const columns = [0, 1, 2, 3, 4].map(i => getColumnContent(i));

    // Durations in seconds (tightened to reduce staggered feel)
    const durations = [95, 92, 98, 93, 96];

    return (
        <div className="absolute inset-0 overflow-hidden bg-brand-white z-0">
            {/* Dynamic style tag for keyframes to guarantee they exist */}
            <style>{`
                @keyframes rise {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); } 
                }
                .masonry-mask {
                    mask-image: linear-gradient(to bottom, transparent 0%, black 2%, black 98%, transparent 100%);
                    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 2%, black 98%, transparent 100%);
                }
            `}</style>

            <div className="flex justify-center gap-4 px-4 items-start h-full masonry-mask">
                {columns.map((col, colIdx) => (
                    <div
                        key={colIdx}
                        className={`flex flex-col gap-4 w-full sm:w-1/2 md:w-1/3 lg:w-1/5`}
                        style={{
                            // Use inline style for animation to bypass Tailwind config issues
                            animationName: 'rise',
                            animationDuration: `${durations[colIdx]}s`,
                            animationTimingFunction: 'linear',
                            animationIterationCount: 'infinite',
                            willChange: 'transform'
                        }}
                    >
                        {col.map((item) => (
                            <div key={item.id} className={`relative w-full ${item.aspectClass} overflow-hidden rounded-lg opacity-80 filter grayscale-[20%] hover:grayscale-0 transition-all duration-500 flex-shrink-0`}>
                                <img
                                    src={item.image}
                                    alt="Moodboard"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Dark Overlay for Readability */}
            <div className="absolute inset-0 bg-black/40 z-10" />
        </div>
    );
};

export default RisingMasonryBackground;
