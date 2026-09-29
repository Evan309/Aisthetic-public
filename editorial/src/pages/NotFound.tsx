import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

const NotFound: React.FC = () => {
    useSeo({
        title: 'Page Not Found | Aisthetic Editorial',
        meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    });

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center bg-brand-white px-4 text-center">
            <span className="text-brand-darkBlue font-medium tracking-widest text-sm uppercase mb-4 block">Error 404</span>
            <h1 className="font-display text-6xl md:text-8xl font-bold mb-6 text-gray-900">Not Found</h1>
            <p className="text-gray-600 text-lg mb-10 max-w-md mx-auto">
                We couldn't find the page you're looking for. It might have been moved or doesn't exist.
            </p>
            <Link
                to="/"
                className="bg-gray-900 text-white px-8 py-4 uppercase tracking-[0.15em] text-sm hover:bg-black transition-all duration-300"
            >
                Return to Editorial
            </Link>
        </div>
    );
};

export default NotFound;
