'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, type MotionValue } from 'framer-motion';
import { ArrowUp, ArrowDown, Handshake } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────
interface MatchProfile {
  name: string;
  age: number;
  location: string;
  initials: string;
  status: string;
  tags: string[];
  timestamp: string;
  gradientFrom: string;
  gradientTo: string;
}

interface MatchVotingSceneProps {
  userA: MatchProfile;
  userB: MatchProfile;
  matchId: number;
  compatibilityReasons: string[];
  onVote: (matchId: number, vote: 'pass' | 'connect' | 'approve') => void;
  voting?: boolean;
  voteCounts?: { yes: number; no: number; total: number };
}

// ─── Gradient Colors for Profiles ─────────────────────────
const GRADIENT_PAIRS = [
  { from: '#a78bfa', to: '#ec4899' },
  { from: '#22d3ee', to: '#3b82f6' },
  { from: '#34d399', to: '#f59e0b' },
  { from: '#f43f5e', to: '#a855f7' },
  { from: '#06b6d4', to: '#8b5cf6' },
];

export function getGradientForProfile(index: number) {
  return GRADIENT_PAIRS[index % GRADIENT_PAIRS.length];
}

// ─── Floating Avatar ────────────────────────────────────
function ProfileAvatar({ profile, floatDelay = 0, className = '' }: { profile: MatchProfile; floatDelay?: number; className?: string }) {
  return (
    <motion.div
      className={`relative ${className}`}
      animate={{ y: [0, -8, 0] }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: floatDelay,
      }}
    >
      {/* Outer glow ring */}
      <div
        className="absolute -inset-3 rounded-full opacity-40 blur-xl"
        style={{
          background: `linear-gradient(135deg, ${profile.gradientFrom}, ${profile.gradientTo})`,
        }}
      />

      {/* Soft glow ring */}
      <div
        className="absolute -inset-1.5 rounded-full"
        style={{
          background: `linear-gradient(135deg, ${profile.gradientFrom}40, ${profile.gradientTo}40)`,
          filter: 'blur(4px)',
        }}
      />

      {/* White frame */}
      <div className="relative w-[180px] h-[180px] md:w-[200px] md:h-[200px] rounded-full p-[3px] bg-white/20 shadow-xl">
        {/* Avatar circle */}
        <div
          className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-4xl select-none"
          style={{
            background: `linear-gradient(135deg, ${profile.gradientFrom}, ${profile.gradientTo})`,
            boxShadow: `0 8px 32px ${profile.gradientFrom}30`,
          }}
        >
          {profile.initials}
        </div>
      </div>

      {/* Subtle shadow beneath */}
      <div
        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[120px] h-[20px] rounded-full opacity-20 blur-lg"
        style={{
          background: `linear-gradient(135deg, ${profile.gradientFrom}, ${profile.gradientTo})`,
        }}
      />
    </motion.div>
  );
}

// ─── Frosted Glass Message Card ─────────────────────────
function MessageCard({ profile, align = 'left', delay = 0 }: { profile: MatchProfile; align?: 'left' | 'right'; delay?: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`relative max-w-[320px] ${align === 'right' ? 'ml-auto' : ''}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className="relative rounded-[20px] p-5 cursor-default"
        animate={{ y: isHovered ? -4 : 0 }}
        transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
        style={{
          background: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: isHovered
            ? '0 16px 48px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)'
            : '0 8px 32px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03)',
        }}
      >
        {/* Name + Timestamp */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[15px] font-semibold" style={{ color: '#1C1C1E' }}>
            {profile.name}
          </h3>
          <span className="text-xs font-medium" style={{ color: '#6E6E73' }}>
            {profile.timestamp}
          </span>
        </div>

        {/* Location */}
        <p className="text-xs mb-2.5 font-medium" style={{ color: '#6E6E73' }}>
          {profile.location} · {profile.age}
        </p>

        {/* Status text */}
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#3a3a3c' }}>
          {profile.status}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {profile.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer transition-colors duration-200 hover:opacity-80"
              style={{
                color: '#4A7BFF',
                background: 'rgba(74, 123, 255, 0.1)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── SVG Chain Link Element ─────────────────────────────
function ChainConnection({ mouseX, mouseY }: { mouseX: MotionValue<number>; mouseY: MotionValue<number> }) {
  const [pulseOffset, setPulseOffset] = useState(0);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      setPulseOffset((prev) => (prev + 0.003) % 1);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const offsetX = useTransform(mouseX, [0, 1], [-5, 5]);
  const offsetY = useTransform(mouseY, [0, 1], [-3, 3]);
  const springX = useSpring(offsetX, { stiffness: 80, damping: 20 });
  const springY = useSpring(offsetY, { stiffness: 80, damping: 20 });

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{ x: springX, y: springY }}
    >
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="chainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#c4b5fd" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
          </linearGradient>

          <filter id="chainGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.4  0 1 0 0 0.3  0 0 1 0 0.9  0 0 0 0.5 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset={`${Math.max(0, pulseOffset - 0.1)}`} stopColor="transparent" />
            <stop offset={`${pulseOffset}`} stopColor="rgba(255,255,255,0.8)" />
            <stop offset={`${Math.min(1, pulseOffset + 0.1)}`} stopColor="transparent" />
          </linearGradient>
        </defs>

        <path
          d="M 180 200 C 300 220, 350 350, 400 300 S 500 250, 620 380"
          stroke="url(#chainGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#chainGlow)"
          opacity="0.7"
        />

        <path
          d="M 180 200 C 300 220, 350 350, 400 300 S 500 250, 620 380"
          stroke="url(#pulseGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />

        {[0.15, 0.35, 0.5, 0.65, 0.85].map((t, i) => {
          const cx = 180 + t * (620 - 180);
          const cy = 200 + Math.sin(t * Math.PI) * 100 + t * 80;
          return (
            <g key={i} opacity={0.5 + Math.sin((pulseOffset + t) * Math.PI * 2) * 0.2}>
              <ellipse
                cx={cx}
                cy={cy}
                rx={12}
                ry={8}
                stroke="url(#chainGrad)"
                strokeWidth="2"
                fill="none"
                transform={`rotate(${-20 + t * 40}, ${cx}, ${cy})`}
                filter="url(#chainGlow)"
              />
            </g>
          );
        })}
      </svg>
    </motion.div>
  );
}

// ─── Action Buttons ─────────────────────────────────────
function ActionButtons({ delay = 0, onVote, voting }: { delay?: number; onVote: (vote: 'pass' | 'connect' | 'approve') => void; voting?: boolean }) {
  const buttons: { icon: typeof ArrowDown; label: string; color: string; action: 'pass' | 'connect' | 'approve' }[] = [
    { icon: ArrowDown, label: 'Pass', color: '#ff6b6b', action: 'pass' },
    { icon: Handshake, label: 'Connect', color: '#4A7BFF', action: 'connect' },
    { icon: ArrowUp, label: 'Approve', color: '#34d399', action: 'approve' },
  ];

  return (
    <motion.div
      className="flex items-center gap-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {buttons.map(({ icon: Icon, label, color, action }) => (
        <motion.button
          key={label}
          className="relative group flex items-center justify-center"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          aria-label={label}
          onClick={() => !voting && onVote(action)}
          disabled={voting}
          style={{ opacity: voting ? 0.5 : 1 }}
        >
          {/* Hover glow */}
          <div
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-40 blur-md transition-opacity duration-300"
            style={{ background: color }}
          />

          {/* Button body */}
          <div
            className="relative w-14 h-14 rounded-full flex items-center justify-center transition-shadow duration-300"
            style={{
              background: 'rgba(255, 255, 255, 0.55)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Icon size={22} color={color} strokeWidth={2} />
          </div>

          {/* Label tooltip */}
          <span
            className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
            style={{ color: '#6E6E73' }}
          >
            {label}
          </span>
        </motion.button>
      ))}
    </motion.div>
  );
}

// ─── Background Gradient ────────────────────────────────
function PastelBackground() {
  return (
    <motion.div
      className="absolute inset-0"
      animate={{
        background: [
          'linear-gradient(135deg, #BFD8FF 0%, #C8C4FF 40%, #F6C7E7 100%)',
          'linear-gradient(135deg, #C8D4FF 0%, #D1C0FF 40%, #F0C7E7 100%)',
          'linear-gradient(135deg, #BFD8FF 0%, #C8C4FF 40%, #F6C7E7 100%)',
        ],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ─── Soft Floating Orbs ─────────────────────────────────
function FloatingOrbs() {
  const orbs = useMemo(
    () => [
      { x: '15%', y: '20%', size: 200, color: '#a78bfa', delay: 0 },
      { x: '75%', y: '60%', size: 160, color: '#22d3ee', delay: 1 },
      { x: '50%', y: '80%', size: 120, color: '#ec4899', delay: 2 },
      { x: '85%', y: '15%', size: 100, color: '#f6c7e7', delay: 0.5 },
      { x: '30%', y: '65%', size: 140, color: '#bfd8ff', delay: 1.5 },
    ],
    []
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color}30 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
          animate={{
            x: [0, 20, -10, 0],
            y: [0, -15, 10, 0],
          }}
          transition={{
            duration: 10 + i * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: orb.delay,
          }}
        />
      ))}
    </div>
  );
}

// ─── Match Status Pill ──────────────────────────────────
function MatchStatusPill({ delay = 0, voteCounts }: { delay?: number; voteCounts?: { yes: number; no: number; total: number } }) {
  return (
    <motion.div
      className="flex items-center gap-2 px-4 py-2 rounded-full"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      style={{
        background: 'rgba(255, 255, 255, 0.5)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-xs font-medium" style={{ color: '#3a3a3c' }}>
        DAO Match Proposal · Awaiting Community Vote
        {voteCounts && (
          <span className="ml-2 text-[10px]" style={{ color: '#6E6E73' }}>
            ({voteCounts.yes + voteCounts.no}/{voteCounts.total} votes)
          </span>
        )}
      </span>
    </motion.div>
  );
}

// ─── Main Match Voting Scene ────────────────────────────
export default function MatchVotingScene({
  userA,
  userB,
  matchId,
  compatibilityReasons,
  onVote,
  voting,
  voteCounts,
}: MatchVotingSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        mouseX.set((e.clientX - rect.left) / rect.width);
        mouseY.set((e.clientY - rect.top) / rect.height);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  const bgX = useTransform(mouseX, [0, 1], [10, -10]);
  const bgY = useTransform(mouseY, [0, 1], [10, -10]);
  const springBgX = useSpring(bgX, { stiffness: 40, damping: 20 });
  const springBgY = useSpring(bgY, { stiffness: 40, damping: 20 });

  const fgX = useTransform(mouseX, [0, 1], [15, -15]);
  const fgY = useTransform(mouseY, [0, 1], [15, -15]);
  const springFgX = useSpring(fgX, { stiffness: 60, damping: 20 });
  const springFgY = useSpring(fgY, { stiffness: 60, damping: 20 });

  const handleVote = (vote: 'pass' | 'connect' | 'approve') => {
    onVote(matchId, vote);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
    >
      <PastelBackground />

      <motion.div style={{ x: springBgX, y: springBgY }}>
        <FloatingOrbs />
      </motion.div>

      <ChainConnection mouseX={mouseX} mouseY={mouseY} />

      <motion.div
        className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8"
        style={{ x: springFgX, y: springFgY }}
      >
        {/* Top status pill */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2">
          <MatchStatusPill delay={0.3} voteCounts={voteCounts} />
        </div>

        {/* Main composition — diagonal layout */}
        <div className="relative w-full max-w-[900px] h-[520px]">
          {/* User 1 — top left */}
          <div className="absolute top-0 left-0 flex items-start gap-6">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <ProfileAvatar profile={userA} floatDelay={0} />
            </motion.div>
            <div className="mt-4">
              <MessageCard profile={userA} align="left" delay={0.5} />
            </div>
          </div>

          {/* Center — action buttons */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <ActionButtons delay={0.8} onVote={handleVote} voting={voting} />
          </div>

          {/* User 2 — bottom right */}
          <div className="absolute bottom-0 right-0 flex items-end gap-6 flex-row-reverse">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <ProfileAvatar profile={userB} floatDelay={1.5} />
            </motion.div>
            <div className="mb-4">
              <MessageCard profile={userB} align="right" delay={0.7} />
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'rgba(60, 60, 67, 0.4)' }}
          >
            Chain Together
          </span>
          <span style={{ color: 'rgba(60, 60, 67, 0.2)' }}>·</span>
          <span
            className="text-[10px] font-medium tracking-wider"
            style={{ color: 'rgba(60, 60, 67, 0.3)' }}
          >
            Decentralized Matchmaking
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
