import React, { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import heroBgImage from "../../assets/images/Hero/big_hero_image_1.jpg";

const SEARCH_PROMPTS = [
  "a going-out top under $100",
  "a first date at a wine bar",
  "a summer wedding guest dress",
  "vintage denim for everyday wear",
  "a quiet luxury outfit",
];

const TypewriterText = () => {
  const [promptIndex, setPromptIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const currentPrompt = SEARCH_PROMPTS[promptIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (isPaused) {
      timeout = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 2000); // pause before deleting
    } else if (isDeleting) {
      if (displayedText === "") {
        setIsDeleting(false);
        setPromptIndex((prev) => (prev + 1) % SEARCH_PROMPTS.length);
      } else {
        timeout = setTimeout(() => {
          setDisplayedText(currentPrompt.slice(0, displayedText.length - 1));
        }, 30); // delete speed
      }
    } else {
      if (displayedText === currentPrompt) {
        setIsPaused(true);
      } else {
        timeout = setTimeout(() => {
          setDisplayedText(currentPrompt.slice(0, displayedText.length + 1));
        }, 60); // typing speed
      }
    }

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, isPaused, promptIndex]);

  return (
    <>
      {displayedText}
      <span className="inline-block align-[-0.12em] ml-1 w-[2px] sm:w-[3px] h-[1em] bg-white animate-pulse rounded-full" />
    </>
  );
};

interface HeroSectionProps {
  searchBar: React.ReactNode;
}

const HeroSection: React.FC<HeroSectionProps> = ({ searchBar }) => {
  const { scrollY } = useScroll();

  // Fade out the hero text as the user scrolls down
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, -50]);

  return (
    <section className="relative w-full min-h-[100svh] overflow-x-hidden flex flex-col items-center justify-center bg-black pt-24 pb-16 sm:pt-28 sm:pb-20">
      {/* Background image */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={heroBgImage}
          alt="Fashion background"
          className="w-full h-full object-cover object-center"
        />

        {/* Dark opacity overlay to soften the image slightly and make text pop */}
        <div className="absolute inset-0 bg-black/50 z-10" />
      </div>

      <div className="z-40 w-full max-w-5xl px-4 sm:px-6 flex flex-col items-center relative">
        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="flex flex-col items-center w-full min-w-0"
        >
          <h1 className="text-center font-display font-medium leading-[1.1] tracking-tight w-full max-w-5xl mx-auto flex flex-col items-center mb-6 sm:mb-8">
            <span className="text-white text-3xl sm:text-[40px] md:text-[50px] lg:text-[60px] mb-2 sm:mb-4">
              Search for
            </span>
            <div className="flex justify-center min-h-[45px] sm:min-h-[55px] md:min-h-[65px] lg:min-h-[80px] items-center w-full min-w-0">
              <span className="bg-[#213A53] text-white px-3 sm:px-4 py-1 sm:py-2 text-[clamp(1.05rem,4.5vw,3.75rem)] max-w-full inline-block text-center leading-tight break-words">
                <TypewriterText />
              </span>
            </div>
          </h1>
          <p className="text-center text-white/70 text-base sm:text-lg md:text-[20px] font-light max-w-2xl px-4 tracking-wide shadow-black drop-shadow-md">
            Transform ideas into outfits with AI-powered fashion discovery
          </p>
        </motion.div>

        <div className="w-full max-w-4xl relative flex justify-center mt-[4vh] sm:mt-[6vh] lg:mt-[8vh]">
          {/* Static Glow Wrapper matching the search bar's default collapsed size. Made very minimal opacity */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(100%-2rem,56rem)] h-[64px] pointer-events-none z-0">
            <div
              className="absolute -inset-2 rounded-[24px] blur-[12px] opacity-20"
              style={{
                background: "radial-gradient(ellipse at center, #213A53 0%, #42596D 50%, transparent 100%)",
              }}
            />
          </div>

          <div className="w-full relative z-30">
            {searchBar}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
