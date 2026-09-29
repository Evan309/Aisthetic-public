import React from 'react';
import { useSeo } from '../hooks/useSeo';

const PrivacyPolicy: React.FC = () => {
    const title = 'Privacy Policy | Aisthetic Editorial';
    const description = "Read Aisthetic Editorial's privacy policy and affiliate disclosure.";

    useSeo({
        title,
        meta: [
            { name: 'description', content: description },
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: 'https://www.aisthetic.shop/privacy' },
            { name: 'twitter:card', content: 'summary_large_image' },
        ],
        links: [{ rel: 'canonical', href: 'https://www.aisthetic.shop/privacy' }],
    });

    return (
        <div className="pt-24 pb-32 bg-white min-h-screen">
            <div className="container-custom max-w-3xl mx-auto px-4 sm:px-6">
                <header className="mb-16 text-center">
                    <span className="text-brand-darkBlue font-medium tracking-widest text-xs uppercase mb-4 block">Legal</span>
                    <h1 className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-6 block">
                        Privacy Policy & Affiliate Disclosure
                    </h1>
                </header>

                <div className="prose prose-lg prose-gray mx-auto">
                    <section className="mb-12">
                        <p className="text-gray-600 font-light leading-relaxed mb-4">
                            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">Amazon Affiliate Disclosure</h2>
                        <p className="text-gray-600 font-light leading-relaxed mb-4">
                            AIsthetic is a participant in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com.
                        </p>
                        <p className="text-gray-600 font-light leading-relaxed mb-4">
                            As an Amazon Associate, we earn from qualifying purchases. This means that whenever you buy a product on Amazon from a link on our site, we receive a small percentage of its price at no extra cost to you.
                        </p>
                        <p className="text-gray-600 font-light leading-relaxed">
                            All products featured on our site currently link to Amazon as part of this affiliate program.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">General Privacy Policy</h2>
                        <p className="text-gray-600 font-light leading-relaxed mb-4">
                            We respect your privacy and are committed to protecting it. Our site currently operates as an editorial platform for fashion discovery.
                            We do not collect personal data such as names or email addresses unless you voluntarily contact us.
                        </p>
                        <p className="text-gray-600 font-light leading-relaxed mb-4">
                            We use third-party tools, including analytical tools and affiliate networks, which may use cookies to track user interactions and purchases in order to credit our site with a commission.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">Contact Us</h2>
                        <p className="text-gray-600 font-light leading-relaxed">
                            If you have any questions about this Privacy Policy, Please contact us at <a href="mailto:team@aisthetic.shop" className="text-brand-darkBlue hover:underline">team@aisthetic.shop</a>.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
