import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Twitter, Youtube } from "lucide-react";
import aistheticLogoWhite from "../assets/images/aisthetic_logo_vo.2_white.png";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-brand-black text-white">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <img
                src={aistheticLogoWhite}
                alt="AIsthetic Logo"
                className="h-9 w-auto object-contain"
              />
            </div>

            <p className="mt-3 text-sm text-white/70 max-w-sm leading-relaxed">
              Search fashion with AI—text or image—then save finds into closets and explore “more like
              this”.
            </p>

            <div className="mt-4 flex items-center gap-3">
              {/* Swap hrefs to your real socials when ready */}
              <a
                href="#"
                aria-label="Instagram"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                aria-label="Twitter"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="#"
                aria-label="YouTube"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div className="md:justify-self-center">
            <h3 className="text-sm font-semibold tracking-wide text-white/90">Quick links</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/" className="text-white/70 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-white/70 hover:text-white transition-colors">
                  Products
                </Link>
              </li>
              <li>
                <Link to="/closets" className="text-white/70 hover:text-white transition-colors">
                  Closets
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-white/70 hover:text-white transition-colors">
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* (Optional) Small right-side blurb — still minimal */}
          <div className="md:justify-self-end">
            <h3 className="text-sm font-semibold tracking-wide text-white/90">Built for discovery</h3>
            <p className="mt-3 text-sm text-white/70 max-w-xs leading-relaxed">
              Find visually similar items, compare alternatives, and organize everything into
              shareable closets.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-xs text-white/60">© {year} AIsthetic. All rights reserved.</div>
          <div className="text-xs text-white/60">
            {/* If you add these routes later, you can turn these into <Link /> */}
            {/* <Link to="/privacy" className="hover:text-white">Privacy</Link> */}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
