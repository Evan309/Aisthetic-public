import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import {
  ArrowRight,
  Heart,
  Lock,
} from "lucide-react";
import { motion, useScroll, useSpring, type Variants } from "framer-motion";


import HowItWorks from "../components/HowItWorks";
import PopularClosets from "../components/PopularClosets";
import BrandsCarousel from "../components/BrandsCarousel";

import { apiClient } from "../utils/api";
import type { BrandWithImage } from "../types";

// Vogue/Editorial easing
const EASING = [0.22, 1, 0.36, 1] as const;

const SECTIONS = [
  { id: "hero", label: "Start" },
  { id: "story", label: "Story" },
  { id: "how-it-works", label: "Process" },
  { id: "closets", label: "Closets" },
  { id: "brands", label: "Brands" },
  { id: "join", label: "Join" },
];

const AboutPage: React.FC = () => {

  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0();


  // brands
  const [brands, setBrands] = useState<BrandWithImage[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setBrandsLoading(true);
        const res = await apiClient.getBrands(1, 20);
        setBrands(res.brands.map((b: any) => ({ ...b, id: String(b.id) })));
      } catch (e) {
        console.error("Failed to fetch brands:", e);
      } finally {
        setBrandsLoading(false);
      }
    };
    fetchBrands();
  }, []);

  const storyBlocks = [
    {
      eyebrow: "Search by vibe",
      title: "Type what you feel.",
      body: "Natural language search that understands aesthetics, moods, and intent — not just keywords.",
    },
    {
      eyebrow: "Build closets",
      title: "Save with intention.",
      body: "Organize finds into closets that feel like vision boards. Revisit, remix, and plan outfits.",
    },
    {
      eyebrow: "Keep your brands close",
      title: "A faster loop.",
      body: "Favorite the labels you trust. Jump back in with one tap whenever you’re ready to shop.",
    },
  ];

  // --- Scroll Spy & Progress ---
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  // track scroll for progress bar
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Parallax transforms (removed for white bg)


  // Intersection Observer for active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -20% 0px", threshold: 0.1 } // trigger when section is in middle
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      // offset for fixed header
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  // Animation variants - smoother, "weightier" feel
  const fadeIn: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.9,
        ease: EASING,
      }
    },
  };

  return (
    <div className="relative min-h-screen bg-white text-gray-900 overflow-x-hidden selection:bg-[#213A53]/20 font-sans">

      {/* FIXED RIGHT SIDEBAR NAVIGATION - Minimal Design */}
      <div className="hidden lg:flex fixed right-8 top-1/2 -translate-y-1/2 z-50 flex-col items-end gap-5">
        {/* Progress Line - minimal thin line */}
        <div className="absolute right-[5px] top-0 bottom-0 w-[1px] bg-gray-100 h-full overflow-hidden">
          <motion.div style={{ scaleY, transformOrigin: "top" }} className="w-full bg-gray-800 h-full" />
        </div>

        {SECTIONS.map(({ id, label }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className={`group relative flex items-center gap-4 py-1 pr-4 transition-all duration-500`}
            >
              <span className={`text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-500 ${isActive ? "opacity-100 translate-x-0 text-gray-900" : "opacity-0 translate-x-4 text-gray-400 group-hover:opacity-100 group-hover:translate-x-0"}`}>
                {label}
              </span>
              <div
                className={`w-[6px] h-[6px] rounded-full transition-all duration-500 ${isActive ? "bg-gray-900 scale-125" : "bg-gray-300 group-hover:bg-gray-500"}`}
              />
            </button>
          );
        })}
      </div>



      <main className="relative z-10 w-full overflow-hidden">

        {/* HERO - Minimal & Editorial */}

        <motion.section
          id="hero"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeIn}
          className="relative min-h-screen max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center pb-40"
        >
          <div className="max-w-4xl space-y-10">
            {/* Main Statement */}
            <motion.h1
              variants={fadeIn}
              className="text-4xl sm:text-5xl lg:text-6xl tracking-tight text-gray-950 font-display leading-[1.1]"
            >
              Shop by aesthetic. <br />
              <span className="text-[#213A53] italic font-serif">Stay in flow.</span>
            </motion.h1>

            <motion.p
              variants={fadeIn}
              className="text-base sm:text-lg text-gray-600 leading-relaxed font-light max-w-xl mx-auto"
            >
              AIsthetic turns your mood into a shopping lane. Describe the vibe, explore curated closets, and let your taste compound.
            </motion.p>

            <motion.div
              variants={fadeIn}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4"
            >
              <Link
                to="/products"
                className="group relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-[#213A53] hover:bg-[#5a1b1b] transition-all rounded-lg shadow-md shadow-[#213A53]/20 hover:-translate-y-0.5"
              >
                Start Browsing
                <ArrowRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              {!authLoading && !isAuthenticated ? (
                <button
                  onClick={() => loginWithRedirect()}
                  className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 transition-all rounded-lg hover:shadow-sm"
                >
                  Sign In
                </button>
              ) : (
                <Link
                  to="/closets"
                  className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 transition-all rounded-lg hover:shadow-sm"
                >
                  My Closets
                </Link>
              )}
            </motion.div>
          </div>
        </motion.section>

        {/* IMMERSIVE STORY */}
        <section id="story" className="relative py-24 bg-white">
          <div className="relative max-w-6xl mx-auto px-6 space-y-10">
            <div className="flex flex-col lg:grid lg:grid-cols-[1fr_1.1fr] gap-16 items-start">

              {/* Sticky Left Text */}
              <div className="sticky top-40 self-start space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-xs uppercase tracking-[0.2em] text-[#213A53] font-semibold"
                >
                  How it feels
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-950 leading-tight"
                >
                  Scroll through <br /> your aesthetic.
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-gray-600 text-lg leading-relaxed max-w-md"
                >
                  Each section layers the product story as you move: search by vibe, save with intention, keep brands
                  close. Designed for a calm, cinematic glide.
                </motion.p>
              </div>

              {/* Scrolling Cards - Minimal */}
              <div className="space-y-12 w-full">
                {storyBlocks.map((block, idx) => (
                  <motion.div
                    key={block.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ margin: "-50px" }}
                    transition={{ duration: 0.8, ease: EASING, delay: idx * 0.1 }}
                    className="group relative overflow-hidden bg-white px-8 py-10 transition-all border-l border-gray-100 hover:border-[#213A53]/30"
                  >
                    <div className="relative flex flex-col gap-4">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-gray-400 font-medium">0{idx + 1} — {block.eyebrow}</div>
                      <h3 className="text-2xl sm:text-3xl font-display text-gray-900">{block.title}</h3>
                      <p className="text-gray-500 leading-relaxed font-light text-base max-w-lg">{block.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <motion.section
          id="how-it-works"
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-10%" }}
          variants={fadeIn}
          className="relative py-28"
        >
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400 font-medium  mb-4">How it works</div>
              <h2 className="text-3xl sm:text-4xl font-display tracking-tight text-gray-950">
                From search → to closets.
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed text-base">
                Start with a vibe. Explore results. Save pieces into closets so you can build looks and revisit them
                later.
              </p>
            </div>
          </div>
          <div className="mt-16 w-full">
            <HowItWorks />
          </div>
        </motion.section>

        {/* CLOSETS */}
        {/* CLOSETS - Full Width */}
        <motion.section
          id="closets"
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-10%" }}
          variants={fadeIn}
          className="relative py-32 bg-white"
        >
          <div className="relative w-full">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 mb-16">
              <div className="max-w-2xl">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-4">Curated closets</div>
                <h2 className="text-3xl sm:text-4xl font-display tracking-tight text-gray-950">
                  Browse closets.
                </h2>
                <p className="mt-6 text-gray-600 leading-relaxed text-base font-light">
                  Explore curated closets to jump into an aesthetic instantly. Save items you love into your own closets.
                </p>
              </div>
            </div>

            <div className="w-full">
              <PopularClosets />
            </div>
          </div>
        </motion.section>

        {/* BRANDS */}
        <motion.section
          id="brands"
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-10%" }}
          variants={fadeIn}
          className="relative py-28"
        >
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400 font-medium mb-4">Favorite brands</div>
              <h2 className="text-3xl sm:text-4xl font-display tracking-tight text-gray-950">
                Keep the brands you trust close.
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed text-base">
                Favoriting brands helps you browse faster and come back to what you already love.
              </p>
            </div>
          </div>

          <div className="mt-16 w-full">
            {brandsLoading ? (
              <div className="py-10 text-center text-gray-400">Loading brands…</div>
            ) : brands.length > 0 ? (
              <BrandsCarousel brands={brands} speed={-0.35} />
            ) : (
              <div className="py-10 text-center text-gray-400">No brands to display.</div>
            )}
          </div>

          <div className="relative mx-auto max-w-6xl px-6 mt-12 flex flex-wrap items-center gap-4">

            <Link
              to="/brands"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              Explore brands <ArrowRight className="w-4 h-4 ml-2" />
            </Link>

            {!authLoading && !isAuthenticated && (
              <button
                onClick={() => loginWithRedirect()}
                className="inline-flex items-center justify-center rounded-lg bg-[#fceceb] text-[#213A53] px-6 py-2.5 text-sm font-medium hover:bg-[#ffe4e2] transition-colors"
              >
                Sign in to favorite <Heart className="w-4 h-4 ml-2 fill-current" />
              </button>
            )}
          </div>
        </motion.section>

        {/* SIGN IN CTA */}
        <motion.section
          id="join"
          initial="hidden"
          whileInView="visible"
          viewport={{ margin: "-200px" }}
          variants={fadeIn}
          className="relative mx-auto max-w-6xl px-6 pb-28 pt-10"
        >
          <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg shadow-gray-100/50">
            <div className="absolute inset-0 bg-gradient-to-br from-[#213A53]/5 via-transparent to-[#213A53]/5 pointer-events-none" />

            <div className="p-10 sm:p-14 relative">
              <div className="flex items-start justify-between gap-10 flex-col lg:flex-row">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm text-xs tracking-[0.15em] uppercase text-gray-600 mb-6">
                    <Lock className="w-3 h-3 text-[#213A53]" />
                    <span>Unlock Full access</span>
                  </div>

                  <h3 className="text-3xl sm:text-5xl font-display tracking-tight text-gray-950 leading-[1.1]">
                    Save, favorite, and build closets that feel like you.
                  </h3>

                  <p className="mt-4 text-gray-600 leading-relaxed text-base max-w-xl">
                    Signing in unlocks closets and favoriting brands. Your saves persist across sessions, so you can pick
                    up right where you left off.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 self-start lg:self-center w-full lg:w-auto">
                  {!authLoading && !isAuthenticated ? (
                    <button
                      onClick={() => loginWithRedirect()}
                      className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-[#213A53] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#112233] shadow-md shadow-[#213A53]/20 transition-all hover:-translate-y-1"
                    >
                      Sign in <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  ) : (
                    <Link
                      to="/closets"
                      className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-[#213A53] text-white px-6 py-2.5 text-sm font-medium hover:bg-[#112233] shadow-md shadow-[#213A53]/20 transition-all hover:-translate-y-1"
                    >
                      Go to closets <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  )}

                  <Link
                    to="/products"
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-all"
                  >
                    Browse <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
            <div className="px-10 py-6 text-sm text-gray-500 text-center bg-gray-50/50">
              AIsthetic is built to reduce noise and help you shop with intention.
            </div>
          </div>
        </motion.section>

      </main>
    </div >
  );
};

export default AboutPage;
