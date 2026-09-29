import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { curatedClosets } from '../data/closets';
import { mockProducts, defaultMockProducts } from '../data/products';
import ProductCard from '../components/ProductCard';
import { useSeo } from '../hooks/useSeo';

const ClosetDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const closet = curatedClosets.find(c => c.id === id);
    const resolvedTitle = closet ? `${closet.title} | Aisthetic Editorial` : 'Closet Not Found | Aisthetic Editorial';
    const resolvedDescription = closet?.excerpt ?? "We couldn't find the closet you're looking for.";
    const resolvedUrl = closet
        ? `https://www.aisthetic.shop/closets/${closet.id}`
        : 'https://www.aisthetic.shop/closets';

    useSeo({
        title: resolvedTitle,
        meta: closet
            ? [
                { name: 'description', content: resolvedDescription },
                { property: 'og:title', content: `${closet.title} | Curated Closet` },
                { property: 'og:description', content: resolvedDescription },
                { property: 'og:image', content: `https://www.aisthetic.shop${closet.imageUrl}` },
                { property: 'og:url', content: resolvedUrl },
                { property: 'og:type', content: 'article' },
                { name: 'twitter:card', content: 'summary_large_image' },
            ]
            : [
                { name: 'description', content: resolvedDescription },
                { name: 'robots', content: 'noindex, nofollow' },
            ],
        links: closet ? [{ rel: 'canonical', href: resolvedUrl }] : [],
        structuredData: closet
            ? {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: closet.title,
                image: [`https://www.aisthetic.shop${closet.imageUrl}`],
                author: [{ '@type': 'Person', name: closet.curator }],
                publisher: {
                    '@type': 'Organization',
                    name: 'Aisthetic',
                    logo: {
                        '@type': 'ImageObject',
                        url: 'https://www.aisthetic.shop/favicon.svg',
                    },
                },
                description: resolvedDescription,
            }
            : null,
    });

    if (!closet) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-white">
                <div className="text-center">
                    <h1 className="font-display text-4xl mb-4">Closet Not Found</h1>
                    <Link to="/" className="text-brand-darkBlue underline">Return Home</Link>
                </div>
            </div>
        );
    }

    const products = mockProducts[closet.id] || defaultMockProducts;

    return (
        <div className="bg-brand-white min-h-screen pb-24">
            {/* Hero Banner */}
            <div className="relative h-[80vh] w-full overflow-hidden">
                <img
                    src={closet.imageUrl}
                    alt={closet.title}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30" />

                <div className="absolute inset-0 flex flex-col justify-end pb-16 container-custom text-white">
                    <Link to="/closets" className="inline-flex items-center text-white/80 hover:text-white mb-6 text-sm font-medium tracking-wide w-fit">
                        <ArrowLeft size={16} className="mr-2" /> Back to Collections
                    </Link>
                    <div className="flex items-center gap-3 text-xs font-medium tracking-wider uppercase mb-4 opacity-90">
                        <span>{closet.curator}</span>
                        <span className="w-1 h-1 bg-white rounded-full"></span>
                        <span>{closet.date}</span>
                    </div>
                    <h1 className="font-display text-5xl md:text-7xl font-bold leading-tight max-w-4xl">
                        {closet.title}
                    </h1>
                </div>
            </div>

            {/* Content Section */}
            <div className="container-custom mt-16 mb-24">
                <div className="flex flex-col md:flex-row gap-16 mb-16 items-start justify-between max-w-5xl">
                    <div className="max-w-xl">
                        <h2 className="font-display text-3xl font-bold mb-6">The Edit</h2>
                        <div className="h-1 w-20 bg-brand-darkBlue mb-6" />
                        <p className="text-gray-600 leading-relaxed text-lg mb-8">
                            {closet.excerpt}
                        </p>
                    </div>

                    <div className="p-6 bg-gray-50 rounded-sm max-w-sm w-full">
                        <h3 className="text-sm font-bold uppercase tracking-wider mb-2">Curator's Note</h3>
                        <p className="text-sm text-gray-500 italic">
                            "This collection focuses on the interplay between structure and fluidity. Each piece can stand alone or work in concert with the others."
                        </p>
                    </div>
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ClosetDetails;
