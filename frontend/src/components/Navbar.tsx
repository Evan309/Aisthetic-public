import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import UserAvatar from "./UserAvatar";
import UserDropdown from "./UserDropdown";
import { useAuth0 } from "@auth0/auth0-react";
import { SignupButton } from "./AuthButtons";
import aistheticLogo from "../assets/images/aisthetic_logo_v0.1.png";

const Navbar: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userDropdownTimeoutRef = React.useRef<number | null>(null);

  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  useEffect(() => {
    if (!isHomePage) {
      setIsScrolled(true);
      return;
    }

    const handleScroll = () => {
      // Transition past a threshold so it feels snappy
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomePage]);

  const handleUserDropdownEnter = () => {
    if (userDropdownTimeoutRef.current) {
      clearTimeout(userDropdownTimeoutRef.current);
      userDropdownTimeoutRef.current = null;
    }
    setShowUserDropdown(true);
  };

  const handleUserDropdownLeave = () => {
    userDropdownTimeoutRef.current = window.setTimeout(() => {
      setShowUserDropdown(false);
    }, 150);
  };

  const isTopOnHome = isHomePage && !isScrolled;

  const navLinkClass = "text-[16px] font-display font-medium tracking-tight transition-colors hover:opacity-70";
  const containerClass = `fixed top-0 left-0 right-0 h-[64px] z-[1000] flex items-center transition-all duration-300 ${
    isTopOnHome ? "bg-transparent" : "bg-[#FFFFFF] shadow-sm"
  }`;
  
  const textColorClass = isTopOnHome ? "text-white drop-shadow-md" : "text-[#000000]";
  
  const logoClass = `h-10 w-auto object-contain select-none transition-all hover:opacity-80 ${
    isTopOnHome ? "brightness-0 invert drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" : ""
  }`;

  return (
    <header className={containerClass}>
      <div className="w-full px-8 flex items-center justify-between h-full">
        {/* Left Side: Brand */}
        <div className="flex-1">
          <Link to="/" className="flex items-center">
            <img
              src={aistheticLogo}
              alt="AIsthetic"
              draggable={false}
              className={logoClass}
            />
          </Link>
        </div>

        {/* Center: Navigation */}
        <nav className={`hidden md:flex flex-none items-center space-x-8 ${textColorClass}`}>
          <Link to="/products" className={navLinkClass}>Explore</Link>
          <Link to="/closets" className={navLinkClass}>Closets</Link>
          <Link to="/brands" className={navLinkClass}>Brands</Link>
        </nav>

        {/* Right Side: Account / Saved */}
        <div className={`flex-1 flex justify-end items-center gap-6 ${textColorClass}`}>
          {/* Mock saved link, could route to closets or specifically saved items */}
          {isAuthenticated && (
            <Link to="/closets" className={navLinkClass}>Saved</Link>
          )}

          {!authLoading && !isAuthenticated ? (
            <SignupButton />
          ) : (
            <div className="relative" onMouseEnter={handleUserDropdownEnter} onMouseLeave={handleUserDropdownLeave}>
              <UserAvatar />
              {showUserDropdown && (
                <div
                  className="
                    absolute top-full right-0 mt-2
                    z-[1000] w-64
                    dropdown-slide-in
                  "
                  onMouseEnter={handleUserDropdownEnter}
                  onMouseLeave={handleUserDropdownLeave}
                >
                  <UserDropdown />
                </div>
              )}
            </div>
          )}
          
          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-1 ml-2 transition-transform hover:scale-105" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-[64px] left-0 w-full bg-white shadow-lg flex flex-col py-4 px-8 z-[900] border-t border-gray-100">
          <Link to="/products" className="text-gray-900 text-lg font-display font-medium tracking-tight py-3 border-b border-gray-100" onClick={() => setMobileMenuOpen(false)}>Explore</Link>
          <Link to="/closets" className="text-gray-900 text-lg font-display font-medium tracking-tight py-3 border-b border-gray-100" onClick={() => setMobileMenuOpen(false)}>Closets</Link>
          <Link to="/brands" className="text-gray-900 text-lg font-display font-medium tracking-tight py-3 border-b border-gray-100" onClick={() => setMobileMenuOpen(false)}>Brands</Link>
          {isAuthenticated && (
            <Link to="/closets" className="text-gray-900 text-lg font-display font-medium tracking-tight py-3" onClick={() => setMobileMenuOpen(false)}>Saved</Link>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
