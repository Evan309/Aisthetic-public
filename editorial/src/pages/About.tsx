import React from 'react';
import { useSeo } from '../hooks/useSeo';

const About: React.FC = () => {
    const title = 'About | Aisthetic Editorial';
    const description = 'AIsthetic is a fashion discovery platform focused on curated style inspiration and editorial closets.';

    useSeo({
        title,
        meta: [
            { name: 'description', content: description },
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:image', content: 'https://www.aisthetic.shop/images/Closets/Quiet_luxury/chic_hero.jpg' },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: 'https://www.aisthetic.shop/about' },
            { name: 'twitter:card', content: 'summary_large_image' },
        ],
        links: [{ rel: 'canonical', href: 'https://www.aisthetic.shop/about' }],
    });

    return (
        <main className="bg-white min-h-screen">
            {/* Hero Section */}
            <section className="pt-32 pb-20 md:pt-40 md:pb-32 px-4 sm:px-6 container-custom mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                    <div className="lg:col-span-7">
                        <span className="text-brand-darkBlue font-medium tracking-widest text-xs lg:text-sm uppercase mb-6 block">About AIsthetic</span>
                        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-gray-900 leading-[1.1] mb-8">
                            Our Vision for <br />
                            <span className="italic font-light text-gray-500">Fashion Discovery</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-600 font-light leading-relaxed max-w-2xl">
                            AIsthetic is a fashion discovery platform focused on curated style inspiration and editorial closets.
                        </p>
                    </div>
                    <div className="lg:col-span-5 relative">
                        <div className="aspect-[4/5] overflow-hidden group">
                            <img
                                src="/images/Closets/Quiet_luxury/chic_hero.jpg"
                                alt="Editorial Fashion"
                                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-in-out"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Intro & Goal */}
            <section className="py-20 bg-gray-50 border-y border-gray-100">
                <div className="container-custom mx-auto px-4 sm:px-6 max-w-4xl text-center">
                    <p className="text-2xl md:text-3xl lg:text-4xl font-display leading-snug text-gray-900 mb-8 w-full">
                        "We highlight thoughtfully selected clothing pieces, outfits, and brands to help readers discover new styles and build cohesive wardrobes."
                    </p>
                    <p className="text-lg text-gray-500 font-light tracking-wide max-w-2xl mx-auto">
                        Our goal is to simplify fashion discovery by organizing clothing into curated closets based on aesthetics, seasons, and lifestyle needs.
                    </p>
                </div>
            </section>

            {/* What you'll find */}
            <section className="py-24 md:py-32 container-custom mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
                    <div className="order-2 md:order-1 relative h-[60vh] md:h-[80vh] overflow-hidden">
                        <img
                            src="/images/Closets/Spring_2026_wardrobe/spring_capsule_2026_hero.jpg"
                            alt="Curated Closets"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="order-1 md:order-2 lg:pl-12">
                        <span className="text-gray-400 font-medium tracking-widest text-xs uppercase mb-4 block">The Experience</span>
                        <h2 className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-8">What You'll Find <br /><span className="italic font-light">on AIsthetic</span></h2>
                        <ul className="space-y-6">
                            {[
                                "Curated fashion closets built around specific aesthetics and wardrobe concepts",
                                "Editorial style guides for outfits and capsule wardrobes",
                                "Brand discovery for emerging and established fashion labels",
                                "Carefully selected clothing pieces linked to trusted retailers"
                            ].map((item, i) => (
                                <li key={i} className="flex items-start">
                                    <span className="text-brand-darkBlue mr-4 mt-1 font-display italic text-lg">0{i + 1}</span>
                                    <span className="text-lg text-gray-600 font-light leading-relaxed">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* Curation Philosophy (Image Grid) */}
            <section className="py-24 bg-brand-darkBlue text-white overflow-hidden">
                <div className="container-custom mx-auto px-4 sm:px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                        <div className="flex flex-col justify-center">
                            <span className="text-brand-lightGrey font-medium tracking-widest text-xs uppercase mb-4 block">Methodology</span>
                            <h2 className="font-display text-4xl md:text-5xl font-bold mb-8">Our Curation <span className="italic font-light">Philosophy</span></h2>
                            <p className="text-xl text-gray-300 font-light leading-relaxed mb-6">
                                Every item featured on AIsthetic is selected to fit a specific aesthetic, outfit concept, or wardrobe theme.
                                Instead of overwhelming readers with thousands of products, we focus on thoughtfully curated selections that work well together.
                            </p>
                            <p className="text-lg text-gray-400 font-light leading-relaxed">
                                Our closets are designed to help readers visualize complete outfits and discover new brands that align with their personal style.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="aspect-[3/4] overflow-hidden mt-12">
                                <img src="/images/Closets/y2k_vintage/y2k-vintage_hero.jpg" alt="Y2K Aesthetic" className="w-full h-full object-cover" />
                            </div>
                            <div className="aspect-[3/4] overflow-hidden">
                                <img src="/images/Closets/Seoul_Street/korean-streetwear_hero.jpg" alt="Seoul Street Aesthetic" className="w-full h-full object-cover" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Text heavy sections at the bottom in a refined grid */}
            <section className="py-24 container-custom mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">

                    {/* Disclosure */}
                    <div className="col-span-1 border-t border-gray-200 pt-8">
                        <h3 className="font-display text-2xl font-bold text-gray-900 mb-6">Affiliate <span className="italic font-light">Disclosure</span></h3>
                        <p className="text-gray-600 font-light leading-relaxed text-sm mb-4">
                            AIsthetic participates in affiliate programs with select retailers. This means that when readers click on product links and make a purchase through partner retailers, AIsthetic may earn a small commission.
                        </p>
                        <p className="text-gray-600 font-light leading-relaxed text-sm mb-4">
                            These commissions help support the editorial work on the site and allow us to continue publishing curated fashion guides and closets.
                        </p>
                        <p className="text-gray-900 font-medium text-sm">
                            All products featured on AIsthetic are independently selected.
                        </p>
                    </div>

                    {/* What we're building next */}
                    <div className="col-span-1 border-t border-gray-200 pt-8">
                        <h3 className="font-display text-2xl font-bold text-gray-900 mb-6">What We're <span className="italic font-light">Building Next</span></h3>
                        <p className="text-gray-600 font-light leading-relaxed text-sm mb-4">
                            AIsthetic is currently developing an AI-powered fashion discovery tool that will allow users to search for clothing using natural language descriptions, images, and aesthetic concepts.
                        </p>
                        <p className="text-gray-600 font-light leading-relaxed text-sm mb-4">
                            This upcoming feature will make it easier for readers to discover products that match a specific vibe, outfit idea, or inspiration image.
                        </p>
                        <p className="text-gray-500 italic text-sm">
                            The search experience is currently in development and will be released in the future.
                        </p>
                    </div>

                    {/* How readers discover & Contact */}
                    <div className="col-span-1 border-t border-gray-200 pt-8 flex flex-col justify-between">
                        <div>
                            <h3 className="font-display text-2xl font-bold text-gray-900 mb-6">How Readers <span className="italic font-light">Discover Us</span></h3>
                            <p className="text-gray-600 font-light leading-relaxed text-sm mb-12">
                                Readers discover AIsthetic through fashion inspiration content, curated style guides, and social media platforms such as Pinterest and visual discovery platforms. Our goal is to help readers explore new fashion ideas and connect them with trusted retailers.
                            </p>
                        </div>

                        <div id="contact">
                            <h3 className="font-display text-2xl font-bold text-gray-900 mb-4">Contact</h3>
                            <p className="text-gray-600 font-light leading-relaxed text-sm mb-4">
                                If you are a brand, retailer, or reader with questions about AIsthetic, feel free to reach out.
                            </p>
                            <a href="mailto:team@aisthetic.shop" className="inline-flex items-center text-brand-darkBlue font-medium hover:text-black hover:underline transition-all">
                                team@aisthetic.shop
                            </a>
                        </div>
                    </div>

                </div>
            </section>
        </main>
    );
};

export default About;
