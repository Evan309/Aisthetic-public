import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface Closet {
    id: string;
    title: string;
    excerpt: string;
    curator: string;
    date: string;
    imageUrl: string;
    itemCount: number;
    aspectRatio?: 'portrait' | 'landscape' | 'square';
}

interface ClosetCardProps {
    closet: Closet;
    aspectRatio?: 'portrait' | 'landscape' | 'square' | 'auto';
    className?: string;
}

const ClosetCard: React.FC<ClosetCardProps> = ({ closet, aspectRatio = 'portrait', className = '' }) => {
    // Determine aspect ratio class
    // 'auto' removes strict aspect ratio and lets the container drive height (h-full)
    let aspectClass = 'aspect-[3/4]';
    if (aspectRatio === 'landscape') aspectClass = 'aspect-[4/3]';
    else if (aspectRatio === 'square') aspectClass = 'aspect-square';
    else if (aspectRatio === 'auto') aspectClass = '';

    return (
        <Link
            to={`/closets/${closet.id}`}
            className={`group cursor-pointer block break-inside-avoid ${aspectRatio === 'auto' ? 'h-full flex flex-col' : 'mb-8'} ${className}`}
        >
            <div className={`relative overflow-hidden rounded-sm bg-gray-100 ${aspectClass} ${aspectRatio === 'auto' ? 'flex-1 min-h-0' : 'mb-4'}`}>
                <img
                    src={closet.imageUrl}
                    alt={closet.title}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-gray-900 flex items-center gap-1.5 shadow-sm">
                    <Layers size={14} />
                    {closet.itemCount} Items
                </div>
            </div>

            {/* Content Section */}
            {/* If auto/constrained, we might need to adjust spacing or font sizes, but for now kept same */}
            <div className={aspectRatio === 'auto' ? 'mt-3' : ''}>
                <div className="flex items-center gap-3 text-xs font-medium tracking-wider text-gray-500 mb-2 uppercase">
                    <span className="text-brand-darkBlue">{closet.curator}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span>{closet.date}</span>
                </div>

                <h3 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-2 group-hover:text-brand-darkBlue transition-colors leading-tight">
                    {closet.title}
                </h3>

                {/* Hide excerpt in small constrained grids if needed, but keeping for now */}
                <p className="text-gray-500 leading-relaxed mb-4 line-clamp-2 max-w-md text-sm md:text-base">
                    {closet.excerpt}
                </p>

                <div className="inline-flex items-center text-sm font-medium text-black border-b border-black/20 pb-0.5 group-hover:border-black transition-colors">
                    View Closet <ArrowRight size={14} className="ml-2" />
                </div>
            </div>
        </Link>
    );
};

export default ClosetCard;
