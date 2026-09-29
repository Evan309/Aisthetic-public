import type { ClosetId } from './types';

export interface Closet {
    id: ClosetId;
    title: string;
    excerpt: string;
    curator: string;
    date: string;
    imageUrl: string;
    itemCount: number;
    aspectRatio: 'portrait' | 'landscape' | 'square';
}

export const curatedClosets: Closet[] = [
    {
        id: 'spring-capsule-2026',
        title: 'The Spring 2026 Capsule',
        excerpt: 'Effortless transitions from crisp mornings to golden afternoons. A collection defined by breathable linens, soft pastels, and versatile layering pieces for the new season.',
        curator: 'Aisthetic Editorial',
        date: 'March 15, 2026',
        imageUrl: '/images/Closets/Spring_2026_wardrobe/spring_capsule_2026_hero.jpg', // Fashion/Spring vibe
        itemCount: 29,
        aspectRatio: 'portrait'
    },
    {
        id: 'quiet-luxury',
        title: 'Quiet Luxury: The Art of Subtle Elegance',
        excerpt: 'Elevate your everyday with unspoken sophistication. Featuring tailored silhouettes, premium cashmere, and a muted palette that whispers refined taste without screaming for attention.',
        curator: 'Aisthetic Editorial',
        date: 'March 10, 2026',
        imageUrl: '/images/Closets/Quiet_luxury/chic_hero.jpg',
        itemCount: 21,
        aspectRatio: 'square'
    },
    {
        id: 'y2k-vintage',
        title: 'Y2K Revival: Modern Nostalgia',
        excerpt: 'The turn-of-the-millennium aesthetic, reimagined. A curated selection of low-rise denim, baby tees, and vintage statement pieces that capture pure 2000s energy.',
        curator: 'Aisthetic Editorial',
        date: 'March 05, 2026',
        imageUrl: '/images/Closets/y2k_vintage/y2k-vintage_hero.jpg',
        itemCount: 31,
        aspectRatio: 'portrait'
    },
    {
        id: 'desk-to-dusk',
        title: 'Desk to Dusk: The Non-Corporate Workwear',
        excerpt: 'Seamlessly shift from boardroom to evening plans with polished yet relaxed styles. Redefining professional attire without compromising on comfort or character.',
        curator: 'Aisthetic Editorial',
        date: 'February 28, 2026',
        imageUrl: '/images/Closets/desk-to-dusk/desk-to-dusk_hero.jpg',
        itemCount: 16,
        aspectRatio: 'landscape'
    },
    {
        id: 'seoul-street',
        title: 'Seoul Street: The Acubi Aesthetic',
        excerpt: 'Master the effortless edge of Korean street fashion. Five essential outfit formulas leaning into the minimalistic, slightly distressed, and avant-garde Acubi look.',
        curator: 'Aisthetic Editorial',
        date: 'February 20, 2026',
        imageUrl: '/images/Closets/Seoul_Street/korean-streetwear_hero.jpg',
        itemCount: 20,
        aspectRatio: 'square'
    }
];

