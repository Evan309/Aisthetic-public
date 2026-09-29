import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import RisingMasonryBackground from '../components/RisingMasonryBackground';
import ClosetCard from '../components/ClosetCard';
import { curatedClosets } from '../data/closets';
import { useSeo } from '../hooks/useSeo';

const Home: React.FC = () => {
    // Trending section can use a subset or reordered list
    const trendingClosets = [...curatedClosets].reverse();
    const title = 'Aisthetic Editorial | Curated Closets';
    const description = 'Discover seasonal capsules, trend-focused edits, and the infinite possibilities of an AI-powered wardrobe.';

    useSeo({
        title,
        meta: [
            { name: 'description', content: description },
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:image', content: 'https://www.aisthetic.shop/images/Closets/Spring_2026_wardrobe/spring_capsule_2026_hero.jpg' },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: 'https://www.aisthetic.shop/' },
            { name: 'twitter:card', content: 'summary_large_image' },
        ],
        links: [{ rel: 'canonical', href: 'https://www.aisthetic.shop/' }],
        structuredData: {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Aisthetic Editorial',
            url: 'https://www.aisthetic.shop/',
        },
    });

    return (
        <main>
            {/* Hero Section */}
            <section className="relative h-screen flex items-center justify-center overflow-hidden">
                <RisingMasonryBackground />
                <div className="absolute inset-0 bg-black/20 z-0 pointer-events-none"></div>

                <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto mt-20">
                    <span className="uppercase tracking-[0.3em] text-[10px] md:text-xs mb-8 block font-light opacity-90">Aisthetic Editorial</span>
                    <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-normal mb-8 leading-tight tracking-tight">
                        The art of <br className="md:hidden" /><span className="italic font-light">curation</span>
                    </h1>
                    <p className="text-sm md:text-base text-white/90 max-w-lg mx-auto mb-12 font-light leading-relaxed tracking-wider">
                        Discover seasonal capsules, trend-focused edits, and the infinite possibilities of an AI-powered wardrobe.
                    </p>
                    <div className="flex justify-center mt-4">
                        <a href="#closets" className="border border-white/50 text-white px-10 py-3 uppercase tracking-[0.15em] text-xs hover:bg-white hover:text-black transition-all duration-300">
                            Explore Collections
                        </a>
                    </div>
                </div>
            </section>

            {/* Featured Closets Grid Section */}
            <section id="closets" className="py-24 bg-white">
                <div className="container-custom px-4 sm:px-6 lg:px-8"> {/* Reduced padding slightly to give more room */}
                    <div className="flex justify-between items-end mb-16 border-b border-gray-100 pb-8">
                        <div>
                            <span className="text-brand-darkBlue font-medium tracking-wider text-xs uppercase mb-3 block">Latest Drops</span>
                            <h2 className="font-display text-4xl md:text-5xl font-bold text-gray-900">Curated Closets</h2>
                        </div>
                        <Link to="/closets" className="hidden md:flex items-center gap-2 text-gray-500 hover:text-black transition-colors font-medium">
                            View all collections <ArrowRight size={18} />
                        </Link>
                    </div>

                    {/* Alternating Grid Layout */}
                    {/* Pattern: Row 1 (Big | 2x2), Row 2 (2x2 | Big), etc. */}
                    {/* Each "Row" consumes 5 items: 1 Big + 4 Small */}
                    {/* We use absolute positioning on the 2x2 grid to force it to match the Big Card's height */}
                    <div className="flex flex-col gap-16 md:gap-24">
                        {(() => {
                            const chunkSize = 5;
                            const chunks = [];
                            for (let i = 0; i < curatedClosets.length; i += chunkSize) {
                                chunks.push(curatedClosets.slice(i, i + chunkSize));
                            }

                            return chunks.map((chunk, chunkIndex) => {
                                const isAlternate = chunkIndex % 2 === 1; // Alternate every row
                                const bigItem = chunk[0];
                                const smallItems = chunk.slice(1, 5);

                                if (!bigItem) return null;

                                return (
                                    <div key={chunkIndex} className="relative w-full">
                                        {/* Big Card - Dictates Height */}
                                        {/* Width is 50% minus half the gap (gap-4 = 16px, half is 8px) */}
                                        <div className={`w-full lg:w-[calc(50%-8px)] ${isAlternate ? 'ml-auto' : ''}`}>
                                            <ClosetCard
                                                closet={bigItem}
                                                aspectRatio="portrait"
                                                className="mb-0"
                                            />
                                        </div>

                                        {/* 2x2 Grid - Absolute to match height */}
                                        {/* Only absolute on LG screens where side-by-side happens */}
                                        {/* Gap between columns is gap-4 (16px). Width is 50% - 8px. */}
                                        <div className={`hidden lg:grid grid-cols-2 grid-rows-2 gap-2 absolute top-0 bottom-0 w-[calc(50%-8px)] ${isAlternate ? 'left-0' : 'right-0'}`}>
                                            {smallItems.map((closet) => (
                                                <ClosetCard
                                                    key={closet.id}
                                                    closet={closet}
                                                    aspectRatio="auto" // Fill the grid cell
                                                    className="mb-0 overflow-hidden"
                                                />
                                            ))}
                                        </div>

                                        {/* Mobile Fallback for 2x2 items (Stacked below on small screens) */}
                                        <div className="lg:hidden grid grid-cols-2 gap-2 mt-4">
                                            {smallItems.map((closet) => (
                                                <ClosetCard
                                                    key={closet.id}
                                                    closet={closet}
                                                    aspectRatio="portrait"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    <div className="mt-20 text-center md:hidden">
                        <Link to="/closets" className="inline-flex items-center gap-2 text-gray-900 font-medium border-b border-gray-900 pb-1">
                            View all collections <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Trending Aesthetics (Horizontal Scroll) */}
            <section className="py-24 bg-gray-50 border-t border-gray-200 overflow-hidden">
                <div className="container-custom mb-12">
                    <span className="text-brand-darkBlue font-medium tracking-wider text-xs uppercase mb-3 block">Trending Now</span>
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-gray-900">Trending Aesthetics</h2>
                </div>

                {/* Horizontal Scroll Container */}
                <div className="flex gap-8 overflow-x-auto pb-12 px-6 sm:px-8 lg:px-12 scrollbar-hide">
                    {trendingClosets.map((closet) => (
                        <div key={closet.id} className="min-w-[300px] md:min-w-[400px]">
                            <ClosetCard closet={closet} aspectRatio="portrait" />
                        </div>
                    ))}
                </div>
            </section>

            {/* Removed Newsletter / CTA */}
        </main>
    );
};

export default Home;
