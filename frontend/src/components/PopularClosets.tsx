"use client";

import { motion, useMotionValue, useAnimationFrame, wrap } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import CuratedClosetCard from "./CuratedClosetCard";
import { useCuratedClosetsSummary } from "../hooks/closets";

export default function PopularClosets() {
  // ---- data ----
  const { data, isLoading, isError } = useCuratedClosetsSummary(1, 12, true);
  const closets = data?.closets ?? [];

  // ---- carousel (KEEP EXACT MECHANISM) ----
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  // Pause on hover (existing behavior)
  const [isPaused, setIsPaused] = useState(false);

  // Also pause while user manually drags/scrolls
  const [isInteracting, setIsInteracting] = useState(false);

  const speed = -0.4; // keep same feel as your original

  // Duplicate list for looping
  const loop = useMemo(() => {
    if (!closets.length) return [];
    return [...closets, ...closets];
  }, [closets]);

  // measure width reliably
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

  // pausable animation (existing behavior, plus pause while interacting)
  useAnimationFrame(() => {
    if (trackWidth > 0 && !isPaused && !isInteracting) {
      const next = x.get() + speed;
      x.set(wrap(-trackWidth, 0, next));
    }
  });

  const normalizeX = () => {
    if (trackWidth > 0) x.set(wrap(-trackWidth, 0, x.get()));
  };

  if (isLoading) {
    return (
      <section className="pt-10 pb-2 overflow-hidden">
        <div className="relative overflow-hidden">
          <div className="flex gap-4 px-4 cursor-default">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="min-w-[58%] sm:min-w-[38%] lg:min-w-[22%] shrink-0 select-none"
              >
                <div className="bg-white border border-gray-200 shadow-sm overflow-hidden animate-pulse">
                  <div className="relative grid grid-cols-[2fr_1fr] gap-1 bg-white">
                    <div className="relative aspect-[16/11] bg-gray-100 overflow-hidden" />
                    <div className="grid grid-rows-2 gap-1">
                      <div className="relative bg-gray-100 overflow-hidden">
                        <div className="aspect-[16/11]" />
                      </div>
                      <div className="relative bg-gray-100 overflow-hidden">
                        <div className="aspect-[16/11]" />
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0">
                      <div className="h-14 bg-gradient-to-t from-black/20 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2">
                        <div className="h-3 w-32 bg-white/60 rounded" />
                        <div className="mt-1 h-3 w-20 bg-white/40 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="pt-10 pb-2">
        <div className="px-4">
          <p className="text-sm text-gray-500">Couldn’t load curated closets.</p>
        </div>
      </section>
    );
  }

  if (!closets.length) return null;

  return (
    <section className="pt-10 pb-2 overflow-hidden">
      <div className="relative overflow-hidden">
        <motion.div
          ref={containerRef}
          className="flex gap-4 px-4 cursor-grab active:cursor-grabbing select-none touch-pan-x"
          style={{ x }}
          drag="x"
          dragMomentum={false}
          dragElastic={0.08}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
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
          {loop.map((c, i) => (
            <motion.div
              key={`${c.id}-${i}`}
              className="min-w-[58%] sm:min-w-[38%] lg:min-w-[22%] shrink-0 select-none"
              whileHover={{ scale: 1.04 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              style={{ transformOrigin: "center" }}
            >
              <CuratedClosetCard
                id={c.id}
                title={c.title}
                description={c.description}
                productCount={c.product_count}
                thumbUrls={c.thumb_urls}
                heroImageUrl={c.hero_image_url}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
