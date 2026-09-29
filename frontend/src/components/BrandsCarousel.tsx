"use client";

import { motion, useMotionValue, useAnimationFrame, wrap } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import BrandCard from "./BrandCard";
import type { BrandWithImage } from "../types";

interface BrandsCarouselProps {
  brands: BrandWithImage[];
  speed?: number; // allow adjustable speed
}

export default function BrandsCarousel({ brands, speed = -0.4 }: BrandsCarouselProps) {
  const x = useMotionValue(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  // Allow user to manually scroll/drag without fighting the animation
  const [isInteracting, setIsInteracting] = useState(false);

  // Duplicate brands list for infinite looping
  const loop = useMemo(() => [...brands, ...brands], [brands]);

  // Measure track width reliably
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.scrollWidth / 2;
      setTrackWidth(width || 0);
    };

    measure();
    requestAnimationFrame(measure);

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [loop.length]);

  // Constant drifting animation (same feel as before)
  useAnimationFrame(() => {
    if (trackWidth <= 0 || isInteracting) return;

    const next = x.get() + speed;
    // keep x wrapped so it loops seamlessly
    x.set(wrap(-trackWidth, 0, next));
  });

  // Normalize x after drag so we never drift too far from wrap bounds
  const normalizeX = () => {
    if (trackWidth > 0) x.set(wrap(-trackWidth, 0, x.get()));
  };

  return (
    <section className="pt-8 pb-10">
      {/* NOTE: keep the same look, but allow manual horizontal interaction */}
      <div className="relative overflow-hidden">
        <motion.div
          ref={containerRef}
          className="flex gap-4 px-3 cursor-grab active:cursor-grabbing select-none touch-pan-x"
          style={{ x }}
          drag="x"
          dragMomentum={false}
          dragElastic={0.08}
          onDragStart={() => setIsInteracting(true)}
          onDragEnd={() => {
            setIsInteracting(false);
            normalizeX();
          }}
          onPointerDown={() => setIsInteracting(true)}
          onPointerUp={() => {
            setIsInteracting(false);
            normalizeX();
          }}
          onPointerCancel={() => {
            setIsInteracting(false);
            normalizeX();
          }}
        >
          {loop.map((brand, i) => (
            <div
              key={`${brand.id}-${i}`}
              className="max-w-[60%] sm:max-w-[30%] lg:max-w-[20%] shrink-0"
            >
              <BrandCard brand={brand} />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
