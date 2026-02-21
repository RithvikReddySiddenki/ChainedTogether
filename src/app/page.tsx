'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

// Dynamic import the entire canvas + scene to avoid SSR issues with Three.js
const GlobeCanvas = dynamic(() => import('@/components/GlobeCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'absolute', inset: 0, background: '#070b14' }} />
  ),
});

// ─── Stage Timeline ──────────────────────────────────────
// globe   → 0s – 3s    : Rotating globe with nodes
// zoom    → 3s – 5.5s  : Camera zooms toward glowing region
// island  → 5.5s – 7.5s: Island assembles, orbiting icons appear
// landing → 7.5s+      : Title, tagline, CTA fade in

const STAGE_TIMINGS = {
  globe: 3000,
  zoom: 2500,
  island: 2000,
};

export default function Home() {
  const router = useRouter();
  const [stage, setStage] = useState('globe');
  const [zoomProgress, setZoomProgress] = useState(0);
  const [showLanding, setShowLanding] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const startTime = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startTime.current;

      if (elapsed < STAGE_TIMINGS.globe) {
        setStage('globe');
      } else if (elapsed < STAGE_TIMINGS.globe + STAGE_TIMINGS.zoom) {
        setStage('zoom');
        const zoomElapsed = elapsed - STAGE_TIMINGS.globe;
        setZoomProgress(zoomElapsed / STAGE_TIMINGS.zoom);
      } else if (
        elapsed <
        STAGE_TIMINGS.globe + STAGE_TIMINGS.zoom + STAGE_TIMINGS.island
      ) {
        setStage('island');
        setZoomProgress(1);
      } else {
        setStage('landing');
        setShowLanding(true);
        setZoomProgress(1);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleGetStarted = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      router.push('/vote');
    }, 800);
  }, [router]);

  return (
    <motion.div
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: '#070b14' }}
      animate={{ opacity: isTransitioning ? 0 : 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* ─── Three.js Canvas ─────────────────────────── */}
      <GlobeCanvas stage={stage} progress={zoomProgress} />

      {/* ─── Vignette overlay ────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(7,11,20,0.6) 100%)',
        }}
      />

      {/* ─── Stage indicator (subtle) ────────────────── */}
      <AnimatePresence>
        {stage !== 'landing' && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {['globe', 'zoom', 'island'].map((s) => (
              <div
                key={s}
                className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                style={{
                  backgroundColor:
                    stage === s ? '#00ffd5' : 'rgba(255,255,255,0.15)',
                  boxShadow:
                    stage === s ? '0 0 8px rgba(0,255,213,0.5)' : 'none',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Landing Overlay ─────────────────────────── */}
      <AnimatePresence>
        {showLanding && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            {/* Title */}
            <motion.h1
              className="text-6xl md:text-8xl font-extrabold tracking-tight text-white text-center leading-none select-none"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.0, delay: 0.2, ease: 'easeOut' }}
              style={{
                textShadow:
                  '0 0 60px rgba(0,255,213,0.3), 0 0 120px rgba(0,255,213,0.1)',
              }}
            >
              CHAINED
              <span
                style={{
                  background:
                    'linear-gradient(135deg, #00ffd5 0%, #22d3ee 50%, #a855f7 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                TOGETHER
              </span>
            </motion.h1>

            {/* Tagline */}
            <motion.p
              className="mt-5 text-lg md:text-xl text-slate-300/80 font-light tracking-wide text-center max-w-lg select-none"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.7, ease: 'easeOut' }}
            >
              Love On-Chain
            </motion.p>

            {/* Decorative line */}
            <motion.div
              className="mt-6 h-px w-24"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.8, delay: 1.0, ease: 'easeOut' }}
              style={{
                background:
                  'linear-gradient(90deg, transparent, #00ffd5, transparent)',
              }}
            />

            {/* CTA Button */}
            <motion.button
              className="pointer-events-auto mt-10 relative group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.3, ease: 'easeOut' }}
              onClick={handleGetStarted}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              {/* Outer glow */}
              <div
                className="absolute -inset-1 rounded-full opacity-50 group-hover:opacity-80 blur-lg transition-opacity duration-300"
                style={{
                  background:
                    'linear-gradient(135deg, #00ffd5, #22d3ee, #a855f7)',
                }}
              />

              {/* Button body */}
              <div
                className="relative px-10 py-3.5 rounded-full font-semibold text-base tracking-wide"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(0,255,213,0.15), rgba(34,211,238,0.1))',
                  border: '1px solid rgba(0,255,213,0.4)',
                  color: '#00ffd5',
                  backdropFilter: 'blur(12px)',
                }}
              >
                Get Started
              </div>
            </motion.button>

            {/* Subtle bottom text */}
            <motion.p
              className="mt-8 text-xs text-slate-500 font-light tracking-widest uppercase select-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.8 }}
            >
              Decentralized · Community-Driven · On-Chain
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
