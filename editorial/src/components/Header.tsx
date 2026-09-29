import React from 'react';
import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const logoCombined = '/images/Home/logo+logo_marker.png';

void React;

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
            <div className="container-custom flex items-center justify-between h-16 md:h-20"> {/* Adjusted height */}
                {/* Mobile Menu Button */}
                <button
                    className="md:hidden p-2 -ml-2 text-brand-darkBlue"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    <Menu size={24} />
                </button>

                {/* Logo Section */}
                <div className="flex-1 md:flex-none flex items-center justify-center md:justify-start">
                    <Link to="/" className="flex items-center group py-2">
                        <img src={logoCombined} alt="Aisthetic" className="h-10 md:h-12 w-auto object-contain" />
                    </Link>
                </div>

                {/* Desktop Nav - Simplified Links */}
                <nav className="hidden md:flex items-center space-x-12">
                    <Link to="/" className="text-gray-500 hover:text-black transition-colors font-display text-lg tracking-wide font-medium">Home</Link>
                    <Link to="/closets" className="text-gray-500 hover:text-black transition-colors font-display text-lg tracking-wide font-medium">Closets</Link>
                    <Link to="/about" className="text-gray-500 hover:text-black transition-colors font-display text-lg tracking-wide font-medium">About</Link>
                </nav>

                {/* Empty div to balance flex justify-between if needed */}
                <div className="w-8 md:hidden"></div>
            </div>

            {/* Mobile Menu (Simple overlay) */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-100 p-4 shadow-lg">
                    <nav className="flex flex-col space-y-4 text-center">
                        <Link to="/" className="text-gray-900 font-medium text-lg py-2" onClick={() => setIsMenuOpen(false)}>Home</Link>
                        <Link to="/closets" className="text-gray-900 font-medium text-lg py-2" onClick={() => setIsMenuOpen(false)}>Closets</Link>
                        <Link to="/about" className="text-gray-900 font-medium text-lg py-2" onClick={() => setIsMenuOpen(false)}>About</Link>
                    </nav>
                </div>
            )}
        </header>
    );
}
