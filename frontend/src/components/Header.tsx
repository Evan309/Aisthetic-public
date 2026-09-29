import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { type Category } from "../utils/api";
import { useCategories } from "../hooks/categories";
import UserAvatar from "./UserAvatar";
import UserDropdown from "./UserDropdown";
import { useAuth0 } from "@auth0/auth0-react";
import { SignupButton } from "./AuthButtons";

// ✅ NEW: square PNG logo
import aistheticLogo from "../assets/images/aisthetic_logo_v0.1.png";

const Header: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();

  // Matches the animated underline hover used in the Brands TOC
  const navUnderlineClass =
    "relative inline-block font-medium font-display transition-colors hover:text-[#213A53] " +
    "after:content-[''] after:absolute after:left-0 after:-bottom-2 after:h-[2px] after:w-full after:bg-[#213A53] " +
    "after:origin-left after:scale-x-0 after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100";

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileCategoriesOpen, setIsMobileCategoriesOpen] = useState(false);
  const { data: categories = [] } = useCategories();
  const [isCategoriesDropdownOpen, setIsCategoriesDropdownOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const navItemRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const userDropdownTimeoutRef = useRef<number | null>(null);

  const groupedCategories = categories.reduce((acc, cat) => {
    if (cat.parentId) {
      const parentId = cat.parentId;
      if (!acc[parentId]) {
        acc[parentId] = [];
      }
      acc[parentId].push(cat);
    }
    return acc;
  }, {} as Record<string, Category[]>);

  const mainCategories = categories.filter((cat) => cat.id.startsWith("main_") && !cat.parentId);

  const categoryGroups: Array<{ main: Category; subs: Category[] }> = mainCategories.map((mainCat) => ({
    main: mainCat,
    subs: groupedCategories[mainCat.id] || [],
  }));

  const categoryOrder = ["clothing", "shoes", "bags", "accessories"];

  const sortedCategoryGroups = categoryGroups.sort((a, b) => {
    const aIndex = categoryOrder.findIndex(
      (order) => a.main.name.toLowerCase().includes(order) || a.main.slug.toLowerCase().includes(order)
    );
    const bIndex = categoryOrder.findIndex(
      (order) => b.main.name.toLowerCase().includes(order) || b.main.slug.toLowerCase().includes(order)
    );

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsCategoriesDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsCategoriesDropdownOpen(false);
    }, 150);
  };

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

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (userDropdownTimeoutRef.current) clearTimeout(userDropdownTimeoutRef.current);
    };
  }, []);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-[1000]">
      <div className="relative">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4 relative">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <img
                src={aistheticLogo}
                alt="AIsthetic"
                draggable={false}
                className="
                  h-6
                  w-auto
                  object-contain
                  select-none
                "
              />
            </Link>

            {/* Center Nav - Desktop */}
            <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center space-x-14 text-gray-700">
              <Link to="/products?on_sale=true">
                <h1 className={navUnderlineClass}>Sale</h1>
              </Link>

              <div
                ref={navItemRef}
                className="relative py-2 -mx-4"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <Link to="/products">
                  <h1 className={navUnderlineClass}>Categories</h1>
                </Link>
              </div>

              <Link to="/closets">
                <h1 className={navUnderlineClass}>Closets</h1>
              </Link>
              <Link to="/brands">
                <h1 className={navUnderlineClass}>Brands</h1>
              </Link>
              <Link to="/about">
                <h1 className={navUnderlineClass}>About</h1>
              </Link>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              <div className="md:hidden w-9" />

              {/* ✅ Signed out: show universal Sign up button (no avatar, no dropdown) */}
              {!authLoading && !isAuthenticated ? (
                <SignupButton />
              ) : (
                <div className="relative" onMouseEnter={handleUserDropdownEnter} onMouseLeave={handleUserDropdownLeave}>
                  <UserAvatar />

                  {showUserDropdown && (
                    <div
                      className="
                        hidden md:block
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

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:text-[#213A53]"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Categories Dropdown */}
        {isCategoriesDropdownOpen && sortedCategoryGroups.length > 0 && (
          <div
            ref={dropdownRef}
            className="
              absolute top-full left-0 w-full
              bg-white border-t border-gray-200
              categories-animate
            "
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              zIndex: 1000,
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          >
            <div className="container mx-auto px-4 py-10">
              <div
                className={`grid gap-12 ${sortedCategoryGroups.length === 4
                  ? "grid-cols-4"
                  : sortedCategoryGroups.length === 3
                    ? "grid-cols-3"
                    : sortedCategoryGroups.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-1"
                  }`}
              >
                {sortedCategoryGroups.map((group) => (
                  <div key={group.main.id} className="flex flex-col">
                    <h3 className="font-bold text-gray-900 text-base mb-6">{group.main.name}</h3>
                    <ul className="space-y-3">
                      <li>
                        <Link
                          to={`/products?main_category=${group.main.slug}`}
                          className="text-gray-700 hover:text-[#213A53] text-sm font-semibold transition-colors block py-1"
                          onClick={() => setIsCategoriesDropdownOpen(false)}
                        >
                          All {group.main.name}
                        </Link>
                      </li>

                      {group.subs.map((subCat) => (
                        <li key={subCat.id}>
                          <Link
                            to={`/products?category=${subCat.slug}`}
                            className="text-gray-700 hover:text-[#213A53] text-sm transition-colors block py-1"
                            onClick={() => setIsCategoriesDropdownOpen(false)}
                          >
                            {subCat.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-200 py-4 shadow-lg z-[999]">
            <div className="container mx-auto px-4">
              <div className="space-y-4">
                <div className="flex items-center justify-around w-full">
                  <button
                    type="button"
                    className={`text-gray-700 ${navUnderlineClass}`}
                    onClick={() => {
                      setIsMobileCategoriesOpen(true);
                      // We keep the menu open behind it so "back" feels natural if we had one,
                      // or close it if we want to reset state.
                      // For now, let's keep it open or close it?
                      // Actually, if we open a full screen overlay, we probably want to close the menu
                      // so when we close the overlay we are back at the page not the menu?
                      // User requested "clicking an x button somewhere closes it".
                      // Let's close the main menu so the overlay is the only thing.
                      setIsMenuOpen(false);
                    }}
                  >
                    Categories
                  </button>
                  <Link
                    to="/products?on_sale=true"
                    className={`text-gray-700 ${navUnderlineClass}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sale
                  </Link>
                  <Link to="/closets" className={`text-gray-700 ${navUnderlineClass}`} onClick={() => setIsMenuOpen(false)}>
                    Closets
                  </Link>
                  <Link to="/brands" className={`text-gray-700 ${navUnderlineClass}`} onClick={() => setIsMenuOpen(false)}>
                    Brands
                  </Link>
                  <Link to="/about" className={`text-gray-700 ${navUnderlineClass}`} onClick={() => setIsMenuOpen(false)}>
                    About
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ User Dropdown (Mobile Mode - Fixed outside container) */}
        {showUserDropdown && (
          <div
            className="
              md:hidden
              fixed right-0 top-[56px]
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

      {/* ✅ Mobile Categories Overlay (Full Screen) */}
      {isMobileCategoriesOpen && (
        <div className="fixed inset-0 z-[2000] bg-white flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-lg text-gray-900">Categories</h3>
            <button
              onClick={() => setIsMobileCategoriesOpen(false)}
              className="p-2 -mr-2 text-gray-600 hover:text-gray-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-8">
              {sortedCategoryGroups.map((group) => (
                <div key={group.main.id}>
                  <h3 className="font-bold text-gray-900 text-base mb-3">{group.main.name}</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <Link
                      to={`/products?main_category=${group.main.slug}`}
                      className="text-gray-700 text-sm py-1 font-medium block"
                      onClick={() => {
                        setIsMobileCategoriesOpen(false);
                        setIsMenuOpen(false);
                      }}
                    >
                      All {group.main.name}
                    </Link>
                    {group.subs.map((subCat) => (
                      <Link
                        key={subCat.id}
                        to={`/products?category=${subCat.slug}`}
                        className="text-gray-600 text-sm py-1 block"
                        onClick={() => {
                          setIsMobileCategoriesOpen(false);
                          setIsMenuOpen(false);
                        }}
                      >
                        {subCat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
