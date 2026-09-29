import React from 'react';
import { Instagram, Twitter } from 'lucide-react';
import { Link } from 'react-router-dom';

const logoCombined = '/images/Home/logo+logo_marker.png';

void React;

export default function Footer() {
    return (
        <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
            <div className="container-custom">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2">
                        <Link to="/" className="inline-block mb-6">
                            <img src={logoCombined} alt="Aisthetic" className="h-10 md:h-12 w-auto object-contain" />
                        </Link>
                        <p className="text-gray-500 max-w-sm mb-6 text-sm leading-relaxed">
                            Curating the intersection of style and intelligence.
                            Discover closets that define the season, crafted for the modern individual inside us all.
                        </p>
                        <div className="flex space-x-4">
                            <a href="mailto:team@aisthetic.shop" className="text-gray-400 hover:text-black transition-colors" aria-label="Email Aisthetic">
                                <Instagram size={18} />
                            </a>
                            <Link to="/about#contact" className="text-gray-400 hover:text-black transition-colors" aria-label="Contact Aisthetic">
                                <Twitter size={18} />
                            </Link>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-medium text-gray-900 mb-4 font-display">Discover</h4>
                        <ul className="space-y-3 text-sm text-gray-500">
                            <li><Link to="/closets" className="hover:text-black transition-colors">All Closets</Link></li>
                            <li><Link to="/closets/spring-capsule-2026" className="hover:text-black transition-colors">Featured Capsules</Link></li>
                            <li><Link to="/closets" className="hover:text-black transition-colors">Seasonal Edits</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-medium text-gray-900 mb-4 font-display">Company</h4>
                        <ul className="space-y-3 text-sm text-gray-500">
                            <li><Link to="/about" className="hover:text-black transition-colors">About</Link></li>
                            <li><Link to="/privacy" className="hover:text-black transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/about#contact" className="hover:text-black transition-colors">Contact</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-400">
                    <p>&copy; {new Date().getFullYear()} Aisthetic. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
