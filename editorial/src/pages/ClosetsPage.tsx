import React from 'react';
import ClosetCard from '../components/ClosetCard';
import { curatedClosets } from '../data/closets';
import { useSeo } from '../hooks/useSeo';

const ClosetsPage: React.FC = () => {
    const title = 'All Collections | Aisthetic Editorial';
    const description = 'Browse every Aisthetic Editorial closet, from seasonal capsules to aesthetic-driven wardrobe edits.';

    useSeo({
        title,
        meta: [
            { name: 'description', content: description },
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:image', content: 'https://www.aisthetic.shop/images/Closets/Spring_2026_wardrobe/spring_capsule_2026_hero.jpg' },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: 'https://www.aisthetic.shop/closets' },
            { name: 'twitter:card', content: 'summary_large_image' },
        ],
        links: [{ rel: 'canonical', href: 'https://www.aisthetic.shop/closets' }],
    });

    return (
        <div className="bg-brand-white min-h-screen pt-32 pb-24">
            <div className="container-custom">
                <div className="text-center mb-16">
                    <span className="text-brand-darkBlue font-medium tracking-wider text-xs uppercase mb-3 block">Archives</span>
                    <h1 className="font-display text-5xl md:text-6xl font-bold text-gray-900 mb-6">All Collections</h1>
                    <p className="text-gray-500 max-w-2xl mx-auto text-lg font-light">
                        Explore our complete archive of AI-curated wardrobes, seasonal capsules, and aesthetic studies.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                    {curatedClosets.map((closet) => (
                        <ClosetCard key={closet.id} closet={closet} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ClosetsPage;
