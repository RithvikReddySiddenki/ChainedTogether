'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
  X,
  Link2,
  User,
  MessageCircle,
} from 'lucide-react';
import { WalletConnect } from '@/components/WalletConnect';
import ConsensusBanner from '@/components/ConsensusBanner';
import { supabase } from '@/lib/supabase';
import { castVote as snapshotCastVote } from '@/services/dao/snapshotClient';

// ─── Types ──────────────────────────────────────────────
interface ProfileData {
  name: string;
  age: number;
  bio: string;
  tags: string[];
  initials: string;
  gradientFrom: string;
  gradientTo: string;
}

interface PairData {
  proposalId: number;
  matchId: number;
  snapshotProposalId?: string;  // Snapshot off-chain proposal ID (if available)
  gradient: [string, string, string];
  profiles: [ProfileData, ProfileData];
}

// ─── Gradient Palettes ──────────────────────────────────
const GRADIENT_SETS: [string, string, string][] = [
  ['#7F7FD5', '#C9B6FF', '#F6C7E7'],
  ['#6DD5FA', '#BDEBFF', '#FBE8FF'],
  ['#FBC2EB', '#D4A5FF', '#A6C1EE'],
  ['#E0C3FC', '#C9D6FF', '#F5E6FF'],
  ['#A1C4FD', '#C2E9FB', '#FFE0F0'],
];

const CARD_GRADIENTS = [
  { from: '#a78bfa', to: '#c084fc' },
  { from: '#818cf8', to: '#6366f1' },
  { from: '#67e8f9', to: '#22d3ee' },
  { from: '#7dd3fc', to: '#38bdf8' },
  { from: '#f9a8d4', to: '#f472b6' },
  { from: '#c4b5fd', to: '#a78bfa' },
  { from: '#d8b4fe', to: '#c084fc' },
  { from: '#93c5fd', to: '#60a5fa' },
  { from: '#fda4af', to: '#fb7185' },
  { from: '#86efac', to: '#4ade80' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Hardcoded Demo Pairs (from spec — used as fallback) ─
const DEMO_PAIRS: PairData[] = [
  {
    proposalId: -1, matchId: -1,
    gradient: ['#7F7FD5', '#C9B6FF', '#F6C7E7'],
    profiles: [
      { name: 'Sophia', age: 26, bio: 'Film photographer exploring the world one frame at a time. Coffee addict.', tags: ['Photography', 'Travel', 'Film'], initials: 'S', gradientFrom: '#a78bfa', gradientTo: '#c084fc' },
      { name: 'Marcus', age: 28, bio: 'Music producer by night, architecture nerd by day. Always building something.', tags: ['Music', 'Design', 'Running'], initials: 'M', gradientFrom: '#818cf8', gradientTo: '#6366f1' },
    ],
  },
  {
    proposalId: -2, matchId: -2,
    gradient: ['#6DD5FA', '#BDEBFF', '#FBE8FF'],
    profiles: [
      { name: 'Luna', age: 24, bio: 'Yoga instructor who paints on weekends. Looking for good conversations.', tags: ['Yoga', 'Art', 'Nature'], initials: 'L', gradientFrom: '#67e8f9', gradientTo: '#22d3ee' },
      { name: 'James', age: 27, bio: 'Chef who reads too many novels. Believes the best dates involve cooking together.', tags: ['Cooking', 'Books', 'Hiking'], initials: 'J', gradientFrom: '#7dd3fc', gradientTo: '#38bdf8' },
    ],
  },
  {
    proposalId: -3, matchId: -3,
    gradient: ['#FBC2EB', '#D4A5FF', '#A6C1EE'],
    profiles: [
      { name: 'Aria', age: 25, bio: 'Dancer and part-time barista. I speak three languages and none of them well.', tags: ['Dance', 'Languages', 'Coffee'], initials: 'A', gradientFrom: '#f9a8d4', gradientTo: '#f472b6' },
      { name: 'Kai', age: 29, bio: 'Surfer, dog dad, and amateur astronomer. Let me show you the stars.', tags: ['Surfing', 'Dogs', 'Space'], initials: 'K', gradientFrom: '#c4b5fd', gradientTo: '#a78bfa' },
    ],
  },
  {
    proposalId: -4, matchId: -4,
    gradient: ['#E0C3FC', '#C9D6FF', '#F5E6FF'],
    profiles: [
      { name: 'Mia', age: 23, bio: 'Grad student studying marine biology. Weekend potter. Chronic playlist maker.', tags: ['Science', 'Pottery', 'Music'], initials: 'M', gradientFrom: '#d8b4fe', gradientTo: '#c084fc' },
      { name: 'Leo', age: 26, bio: 'Filmmaker with too many houseplants. Looking for someone to watch weird movies with.', tags: ['Film', 'Plants', 'Vinyl'], initials: 'L', gradientFrom: '#93c5fd', gradientTo: '#60a5fa' },
    ],
  },
  {
    proposalId: -5, matchId: -5,
    gradient: ['#A1C4FD', '#C2E9FB', '#FFE0F0'],
    profiles: [
      { name: 'Zara', age: 27, bio: 'Architect who sketches in cafes. Searching for a fellow adventurer and bookworm.', tags: ['Architecture', 'Sketching', 'Travel'], initials: 'Z', gradientFrom: '#fda4af', gradientTo: '#fb7185' },
      { name: 'Ethan', age: 30, bio: 'Rock climber and software engineer. I make a mean sourdough.', tags: ['Climbing', 'Baking', 'Camping'], initials: 'E', gradientFrom: '#86efac', gradientTo: '#4ade80' },
    ],
  },
];

function getDemoVotes(): Record<number, { approves: number; rejects: number }> {
  const votes: Record<number, { approves: number; rejects: number }> = {};
  DEMO_PAIRS.forEach((_, i) => {
    votes[i] = {
      approves: Math.floor(Math.random() * 20) + 2,
      rejects: Math.floor(Math.random() * 8),
    };
  });
  return votes;
}

// ─── Transform Supabase data into PairData ──────────────
function profileToCardData(
  profile: any,
  colorIndex: number
): ProfileData {
  const grad = CARD_GRADIENTS[colorIndex % CARD_GRADIENTS.length];
  const interests: string[] = profile.answers_json?.interests || [];
  const tags =
    interests.length > 0
      ? interests.slice(0, 3)
      : ['Web3', 'Community'];

  return {
    name: profile.name || 'Anonymous',
    age: profile.age || 0,
    bio:
      profile.bio ||
      profile.answers_json?.goals ||
      'Looking for meaningful connections in Web3.',
    tags,
    initials: getInitials(profile.name || 'AN'),
    gradientFrom: grad.from,
    gradientTo: grad.to,
  };
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS (from spec)
// ═══════════════════════════════════════════════════════════

// ─── Bottom Tab Bar ─────────────────────────────────────
function BottomTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
}) {
  const tabs: { key: string; label: string; Icon: typeof Link2 }[] = [
    { key: 'matches', label: 'Matches', Icon: Link2 },
    { key: 'profile', label: 'Profile', Icon: User },
    { key: 'messages', label: 'Messages', Icon: MessageCircle },
  ];

  return (
    <nav
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-20 z-30 px-20 py-5"
      style={{
        borderRadius: '28px',
        background: 'rgba(255, 255, 255, 0.16)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid rgba(255, 255, 255, 0.28)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
      }}
      aria-label="Main navigation"
    >
      {tabs.map(({ key, label, Icon }) => {
        const isActive = activeTab === key;
        return (
          <motion.button
            key={key}
            className="relative flex flex-col items-center gap-1.5"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onTabChange(isActive ? null : key)}
          >
            {isActive && (
              <div
                className="absolute -inset-3 rounded-2xl opacity-25 blur-lg"
                style={{ background: 'white' }}
              />
            )}
            <Icon
              size={28}
              color="white"
              strokeWidth={isActive ? 3 : 2.5}
              style={{ opacity: isActive ? 1 : 0.6 }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: 'white', opacity: isActive ? 1 : 0.5 }}
            >
              {label}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
}

// ─── Voting Controls (center column) ────────────────────
function VotingControls({
  onOpenComments,
  onVoteYes,
  onVoteNo,
}: {
  onOpenComments: () => void;
  onVoteYes: () => void;
  onVoteNo: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Reject */}
      <motion.button
        className="relative group flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
        aria-label="Reject this match"
        onClick={onVoteNo}
      >
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-200"
          style={{ background: '#ff6b6b' }}
        />
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          <ThumbsDown size={22} color="#ff6b6b" strokeWidth={2} />
        </div>
      </motion.button>

      {/* Approve */}
      <motion.button
        className="relative group flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
        aria-label="Approve this match"
        onClick={onVoteYes}
      >
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-200"
          style={{ background: '#34d399' }}
        />
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          <ThumbsUp size={22} color="#34d399" strokeWidth={2} />
        </div>
      </motion.button>

      {/* Comment */}
      <motion.button
        className="relative group flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
        onClick={onOpenComments}
        aria-label="Open comments"
      >
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-200"
          style={{ background: '#60a5fa' }}
        />
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          }}
        >
          <MessageSquare size={22} color="#60a5fa" strokeWidth={2} />
        </div>
      </motion.button>
    </div>
  );
}

// ─── Comments Slide-Up Panel ────────────────────────────
function CommentsPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [comment, setComment] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const sampleComments = [
    { name: 'Ava', text: 'They would be so good together!', time: '2m' },
    { name: 'Jordan', text: 'I can already see the chemistry', time: '5m' },
    { name: 'Riley', text: 'Love this pairing, voting yes', time: '8m' },
    {
      name: 'Casey',
      text: 'Two creative souls, this is perfect',
      time: '12m',
    },
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ background: 'rgba(0, 0, 0, 0.3)' }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              height: '55vh',
              background: 'white',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-1 rounded-full bg-gray-200 absolute top-3 left-1/2 -translate-x-1/2" />
                <h3
                  className="text-[17px] font-semibold"
                  style={{ color: '#1C1C1E' }}
                >
                  Comments
                </h3>
                <span className="text-sm" style={{ color: '#6E6E73' }}>
                  {sampleComments.length}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-150 hover:bg-gray-100"
                aria-label="Close comments"
              >
                <X size={18} color="#6E6E73" strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {sampleComments.map((c, i) => (
                <div key={i} className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold"
                    style={{
                      background: ['#a78bfa', '#67e8f9', '#f9a8d4', '#86efac'][
                        i % 4
                      ],
                    }}
                  >
                    {c.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: '#1C1C1E' }}
                      >
                        {c.name}
                      </span>
                      <span className="text-xs" style={{ color: '#AEAEB2' }}>
                        {c.time}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: '#3a3a3c' }}>
                      {c.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="flex-1 text-sm py-2.5 px-4 rounded-full outline-none"
                style={{
                  background: '#F2F2F7',
                  color: '#1C1C1E',
                  border: 'none',
                }}
              />
              <motion.button
                className="w-10 h-10 rounded-full flex items-center justify-center"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  background: comment.trim() ? '#60a5fa' : '#E5E5EA',
                }}
              >
                <Send
                  size={16}
                  color={comment.trim() ? 'white' : '#AEAEB2'}
                  strokeWidth={2}
                />
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Profile Card (click to expand) ─────────────────────
function ProfileCard({
  profile,
  reducedMotion,
}: {
  profile: ProfileData;
  side?: 'left' | 'right';
  reducedMotion?: boolean | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCardClick = useCallback(() => {
    if (!isOpen) setIsOpen(true);
  }, [isOpen]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(false);
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  return (
    <motion.div
      className="relative cursor-pointer select-none"
      style={{
        width: '400px',
        height: '600px',
        borderRadius: '28px',
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.18)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
      }}
      animate={{ scale: isOpen ? 0.96 : 1 }}
      transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
      onClick={handleCardClick}
      role="article"
      aria-label={`Profile: ${profile.name}, ${profile.age}`}
      aria-expanded={isOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(!isOpen);
        }
      }}
    >
      {/* Portrait gradient area */}
      <div className="absolute inset-0">
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background: `linear-gradient(160deg, ${profile.gradientFrom}, ${profile.gradientTo})`,
          }}
        >
          <span className="text-white/30 text-[120px] font-extralight select-none leading-none">
            {profile.initials}
          </span>
        </div>
      </div>

      {/* Bottom gradient overlay (visible when panel closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            className="absolute inset-x-0 bottom-0 h-[45%] pointer-events-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Name + age (visible when panel closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            className="absolute bottom-5 left-5 right-5 z-10"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-white text-xl font-semibold">
              {profile.name}, {profile.age}
            </h3>
          </motion.div>
        )}
      </AnimatePresence>

      {/* White description panel — slides up on click */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute inset-x-0 bottom-0 z-20"
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              height: '60%',
              background: 'white',
              borderRadius: '20px 20px 28px 28px',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.06)',
            }}
          >
            <button
              className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center rounded-full transition-opacity duration-150"
              style={{ opacity: 0.6 }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.opacity = '1')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.opacity = '0.6')
              }
              onClick={handleClose}
              aria-label="Close profile details"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
              >
                <path
                  d="M1 1L13 13M13 1L1 13"
                  stroke="#1C1C1E"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="px-6 pt-6 pb-6 h-full flex flex-col">
              <h3
                className="font-bold leading-tight"
                style={{ fontSize: '21px', color: '#1C1C1E' }}
              >
                {profile.name}
              </h3>
              <p
                className="mt-1 font-medium"
                style={{ fontSize: '15px', color: '#6E6E73' }}
              >
                {profile.age} years old
              </p>
              <p
                className="mt-4 leading-relaxed"
                style={{
                  fontSize: '14px',
                  color: '#3a3a3c',
                  lineHeight: '1.6',
                }}
              >
                {profile.bio}
              </p>
              <div className="flex flex-wrap gap-2 mt-auto pt-4">
                {profile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ background: '#F2F2F7', color: '#1C1C1E' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Scroll Indicator Arrow ─────────────────────────────
function ScrollArrow({ isLast = false }: { isLast?: boolean }) {
  if (isLast) return null;
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      animate={{ y: [0, 6, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <span className="text-white/40 text-xs font-light tracking-wider">
        Scroll
      </span>
      <svg
        width="20"
        height="10"
        viewBox="0 0 20 10"
        fill="none"
        className="opacity-40"
      >
        <path
          d="M2 2L10 8L18 2"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

// ─── Section Pair ───────────────────────────────────────
function PairSection({
  pair,
  index,
  activeIndex,
  isLast,
  reducedMotion,
  onOpenComments,
  onVoteYes,
  onVoteNo,
}: {
  pair: PairData;
  index: number;
  activeIndex: number;
  isLast: boolean;
  reducedMotion: boolean | null;
  onOpenComments: () => void;
  onVoteYes: () => void;
  onVoteNo: () => void;
}) {
  const isActive = index === activeIndex;
  const offset = index - activeIndex;

  return (
    <section
      className="relative w-full flex-shrink-0 flex items-center justify-center"
      style={{ height: '100vh', scrollSnapAlign: 'start' }}
      aria-label={`Match pair ${index + 1}: ${pair.profiles[0].name} and ${pair.profiles[1].name}`}
    >
      <motion.div
        className="flex items-center justify-center"
        style={{ gap: '40px', maxWidth: '1200px' }}
        animate={{
          opacity: isActive ? 1 : 0.5,
          y: reducedMotion ? 0 : isActive ? 0 : offset * 20,
        }}
        transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
      >
        <ProfileCard
          profile={pair.profiles[0]}
          side="left"
          reducedMotion={reducedMotion}
        />
        <VotingControls
          onOpenComments={onOpenComments}
          onVoteYes={onVoteYes}
          onVoteNo={onVoteNo}
        />
        <ProfileCard
          profile={pair.profiles[1]}
          side="right"
          reducedMotion={reducedMotion}
        />
      </motion.div>
      <ScrollArrow isLast={isLast} />
    </section>
  );
}

// ─── Tab Panel Stubs ────────────────────────────────────
function MatchesView() {
  return (
    <div className="p-6">
      <h2
        className="text-xl font-bold mb-4"
        style={{ color: '#1C1C1E' }}
      >
        Your Matches
      </h2>
      <p className="text-sm" style={{ color: '#6E6E73' }}>
        Approved matches will appear here. Check back after the community votes!
      </p>
    </div>
  );
}

function ProfileTab() {
  return (
    <div className="p-6">
      <h2
        className="text-xl font-bold mb-4"
        style={{ color: '#1C1C1E' }}
      >
        Your Profile
      </h2>
      <p className="text-sm" style={{ color: '#6E6E73' }}>
        Profile settings and preferences.
      </p>
    </div>
  );
}

function DMTab() {
  return (
    <div className="p-6">
      <h2
        className="text-xl font-bold mb-4"
        style={{ color: '#1C1C1E' }}
      >
        Messages
      </h2>
      <p className="text-sm" style={{ color: '#6E6E73' }}>
        Conversations with your approved matches.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE — DiscoverReels
// ═══════════════════════════════════════════════════════════

export default function VotePage() {
  const { address, isConnected } = useAccount();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Data state ───────────────────────────────────────
  const [pairs, setPairs] = useState<PairData[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── UI state (from spec) ─────────────────────────────
  const [activeIndex, setActiveIndex] = useState(0);
  const [pairVotes, setPairVotes] = useState<
    Record<number, { approves: number; rejects: number }>
  >({});
  const [votedPairs, setVotedPairs] = useState<Set<number>>(new Set());
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const [bgGradient, setBgGradient] = useState(
    `linear-gradient(135deg, #7F7FD5, #C9B6FF, #F6C7E7)`
  );
  const prefersReducedMotion = useReducedMotion();

  const { data: walletClient } = useWalletClient();

  // ─── Load pairs from Supabase ─────────────────────────
  useEffect(() => {
    if (isConnected && address) {
      loadPairs();
    }
  }, [isConnected, address]);

  function useDemoPairs() {
    console.log('[VotePage] Using demo pairs (Supabase returned no data)');
    setPairs(DEMO_PAIRS);
    setPairVotes(getDemoVotes());
    setVotedPairs(new Set());
    const g = DEMO_PAIRS[0].gradient;
    setBgGradient(`linear-gradient(135deg, ${g[0]}, ${g[1]}, ${g[2]})`);
  }

  async function loadPairs() {
    if (!address) return;
    const walletLower = address.toLowerCase();

    try {
      setLoading(true);

      // 1. Try loading voting proposals directly
      const { data: allVoting, error: votingError } = await supabase
        .from('match_proposals')
        .select('*')
        .eq('status', 'voting')
        .limit(20);

      console.log('[VotePage] Voting proposals:', allVoting?.length ?? 0, 'error:', votingError?.message ?? 'none');

      if (votingError || !allVoting || allVoting.length === 0) {
        useDemoPairs();
        return;
      }

      // 2. Check which ones user already voted on
      const proposalIds = allVoting.map((p) => p.id);
      const { data: existingVotes } = await supabase
        .from('match_votes')
        .select('match_proposal_id')
        .eq('voter_address', walletLower)
        .in('match_proposal_id', proposalIds);

      const alreadyVotedIds = new Set(
        (existingVotes || []).map((v) => v.match_proposal_id)
      );

      // 3. Fetch all related profiles
      const allAddresses = new Set<string>();
      allVoting.forEach((p) => {
        allAddresses.add(p.user_a_address);
        allAddresses.add(p.user_b_address);
      });

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('wallet_address', Array.from(allAddresses));

      console.log('[VotePage] Profiles loaded:', profiles?.length ?? 0, 'error:', profileError?.message ?? 'none');

      if (profileError || !profiles || profiles.length === 0) {
        useDemoPairs();
        return;
      }

      const profileMap = new Map<string, any>();
      profiles.forEach((p) => {
        profileMap.set(p.wallet_address.toLowerCase(), p);
      });

      // 4. Build PairData array
      const builtPairs: PairData[] = [];
      const initialPairVotes: Record<number, { approves: number; rejects: number }> = {};
      const initialVotedSet = new Set<number>();

      for (const proposal of allVoting) {
        const profileA = profileMap.get(proposal.user_a_address.toLowerCase());
        const profileB = profileMap.get(proposal.user_b_address.toLowerCase());
        if (!profileA || !profileB) continue;

        const pairIndex = builtPairs.length;
        const gradientSet = GRADIENT_SETS[pairIndex % GRADIENT_SETS.length];

        builtPairs.push({
          proposalId: proposal.id,
          matchId: proposal.on_chain_proposal_id || proposal.id,
          gradient: gradientSet,
          profiles: [
            profileToCardData(profileA, pairIndex * 2),
            profileToCardData(profileB, pairIndex * 2 + 1),
          ],
        });

        initialPairVotes[pairIndex] = {
          approves: proposal.yes_votes || 0,
          rejects: proposal.no_votes || 0,
        };

        if (alreadyVotedIds.has(proposal.id)) {
          initialVotedSet.add(pairIndex);
        }
      }

      console.log('[VotePage] Built', builtPairs.length, 'pairs from', allVoting.length, 'proposals');

      // If no pairs could be built (missing profiles), use demo
      if (builtPairs.length === 0) {
        useDemoPairs();
        return;
      }

      setPairs(builtPairs);
      setPairVotes(initialPairVotes);
      setVotedPairs(initialVotedSet);

      const g = builtPairs[0].gradient;
      setBgGradient(`linear-gradient(135deg, ${g[0]}, ${g[1]}, ${g[2]})`);
    } catch (error) {
      console.error('[VotePage] Failed to load pairs:', error);
      // On any error, fall back to demo data
      useDemoPairs();
    } finally {
      setLoading(false);
    }
  }

  // ─── Scroll tracking ─────────────────────────────────
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const sectionHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / sectionHeight);
      const clampedIndex = Math.max(
        0,
        Math.min(newIndex, pairs.length - 1)
      );
      if (clampedIndex !== activeIndex) setActiveIndex(clampedIndex);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex, pairs.length]);

  // ─── Background gradient crossfade ────────────────────
  useEffect(() => {
    if (pairs.length === 0) return;
    const g = pairs[activeIndex]?.gradient;
    if (g) {
      setBgGradient(
        `linear-gradient(135deg, ${g[0]}, ${g[1]}, ${g[2]})`
      );
    }
  }, [activeIndex, pairs]);

  // ─── Keyboard navigation ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const container = scrollRef.current;
      if (!container) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        container.scrollTo({
          top:
            Math.min(activeIndex + 1, pairs.length - 1) *
            container.clientHeight,
          behavior: 'smooth',
        });
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        container.scrollTo({
          top:
            Math.max(activeIndex - 1, 0) * container.clientHeight,
          behavior: 'smooth',
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, pairs.length]);

  // ─── Vote handlers ────────────────────────────────────
  const handleVoteYes = useCallback(
    async (pairIndex: number) => {
      if (!address || votedPairs.has(pairIndex)) return;

      // Optimistic UI update
      setPairVotes((prev) => ({
        ...prev,
        [pairIndex]: {
          ...prev[pairIndex],
          approves: (prev[pairIndex]?.approves || 0) + 1,
        },
      }));
      setVotedPairs((prev) => new Set(prev).add(pairIndex));

      // Persist to Supabase
      const pair = pairs[pairIndex];
      if (!pair) return;
      try {
        await supabase.from('match_votes').insert({
          match_proposal_id: pair.proposalId,
          voter_address: address.toLowerCase(),
          vote_choice: true,
        });

        const { data: current } = await supabase
          .from('match_proposals')
          .select('yes_votes, no_votes, total_votes_cast')
          .eq('id', pair.proposalId)
          .single();

        if (current) {
          await supabase
            .from('match_proposals')
            .update({
              yes_votes: (current.yes_votes || 0) + 1,
              total_votes_cast: (current.total_votes_cast || 0) + 1,
            })
            .eq('id', pair.proposalId);
        }

        // Gasless Snapshot vote (non-blocking)
        if (pair.snapshotProposalId && walletClient) {
          try {
            await snapshotCastVote({
              web3: walletClient,
              account: address,
              proposalId: pair.snapshotProposalId,
              choice: 1, // 1 = Approve
            });
          } catch (e) {
            console.warn('Snapshot vote failed (continuing):', e);
          }
        }
      } catch (error) {
        console.error('Failed to record vote:', error);
      }
    },
    [address, pairs, votedPairs, walletClient]
  );

  const handleVoteNo = useCallback(
    async (pairIndex: number) => {
      if (!address || votedPairs.has(pairIndex)) return;

      // Optimistic UI update
      setPairVotes((prev) => ({
        ...prev,
        [pairIndex]: {
          ...prev[pairIndex],
          rejects: (prev[pairIndex]?.rejects || 0) + 1,
        },
      }));
      setVotedPairs((prev) => new Set(prev).add(pairIndex));

      // Persist to Supabase
      const pair = pairs[pairIndex];
      if (!pair) return;
      try {
        await supabase.from('match_votes').insert({
          match_proposal_id: pair.proposalId,
          voter_address: address.toLowerCase(),
          vote_choice: false,
        });

        const { data: current } = await supabase
          .from('match_proposals')
          .select('yes_votes, no_votes, total_votes_cast')
          .eq('id', pair.proposalId)
          .single();

        if (current) {
          await supabase
            .from('match_proposals')
            .update({
              no_votes: (current.no_votes || 0) + 1,
              total_votes_cast: (current.total_votes_cast || 0) + 1,
            })
            .eq('id', pair.proposalId);
        }

        // Gasless Snapshot vote (non-blocking)
        if (pair.snapshotProposalId && walletClient) {
          try {
            await snapshotCastVote({
              web3: walletClient,
              account: address,
              proposalId: pair.snapshotProposalId,
              choice: 2, // 2 = Reject
            });
          } catch (e) {
            console.warn('Snapshot vote failed (continuing):', e);
          }
        }
      } catch (error) {
        console.error('Failed to record vote:', error);
      }
    },
    [address, pairs, votedPairs, walletClient]
  );

  // ─── Not connected ───────────────────────────────────
  if (!isConnected) {
    return (
      <div
        className="w-screen h-screen flex items-center justify-center"
        style={{ background: '#070b14' }}
      >
        <motion.div
          className="text-center space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="text-3xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #00ffd5, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Connect Your Wallet
          </h2>
          <p className="text-slate-400 max-w-sm">
            Connect your wallet to start voting on match proposals
          </p>
          <WalletConnect />
        </motion.div>
      </div>
    );
  }

  // ─── Loading ─────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="w-screen h-screen flex items-center justify-center"
        style={{
          background:
            'linear-gradient(135deg, #7F7FD5, #C9B6FF, #F6C7E7)',
        }}
      >
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{
              borderColor: 'rgba(255,255,255,0.6)',
              borderTopColor: 'transparent',
            }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Loading match proposals...
          </p>
        </motion.div>
      </div>
    );
  }

  // ─── Empty state ─────────────────────────────────────
  if (pairs.length === 0) {
    return (
      <div
        className="w-screen h-screen flex items-center justify-center"
        style={{
          background:
            'linear-gradient(135deg, #7F7FD5, #C9B6FF, #F6C7E7)',
        }}
      >
        <motion.div
          className="text-center space-y-4 p-10 max-w-md"
          style={{
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.18)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h2
            className="text-2xl font-bold"
            style={{ color: 'rgba(255,255,255,0.95)' }}
          >
            No Pairs Yet
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>
            No match proposals to vote on right now. Check back later!
          </p>
          <motion.button
            className="mt-4 px-6 py-2.5 rounded-full text-sm font-medium"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => loadPairs()}
          >
            Refresh
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ─── Main DiscoverReels ──────────────────────────────
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Animated background gradient */}
      <motion.div
        className="absolute inset-0"
        animate={{ background: bgGradient }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />

      {/* Consensus Banner */}
      <ConsensusBanner
        matchId={activeIndex + 1}
        approves={pairVotes[activeIndex]?.approves || 0}
        rejects={pairVotes[activeIndex]?.rejects || 0}
        loading={false}
        visible={votedPairs.has(activeIndex)}
      />

      {/* CHAIN (left vertical text) */}
      <div
        className="fixed left-[5%] top-1/2 -translate-y-1/2 z-20 flex flex-col items-center select-none pointer-events-none"
        aria-hidden="true"
      >
        {'CHAIN'.split('').map((letter, i) => (
          <span
            key={i}
            className="block font-extrabold leading-none"
            style={{
              fontSize: '48px',
              color: 'rgba(255, 255, 255, 0.9)',
              textShadow: '0 2px 20px rgba(0, 0, 0, 0.1)',
              letterSpacing: '0.04em',
            }}
          >
            {letter}
          </span>
        ))}
      </div>

      {/* TOGETHER (right vertical text) */}
      <div
        className="fixed right-[5%] top-1/2 -translate-y-1/2 z-20 flex flex-col items-center select-none pointer-events-none"
        aria-hidden="true"
      >
        {'TOGETHER'.split('').map((letter, i) => (
          <span
            key={i}
            className="block font-extrabold leading-none"
            style={{
              fontSize: '48px',
              color: 'rgba(255, 255, 255, 0.9)',
              textShadow: '0 2px 20px rgba(0, 0, 0, 0.1)',
              letterSpacing: '0.04em',
            }}
          >
            {letter}
          </span>
        ))}
      </div>

      {/* Section dot indicators */}
      <div className="fixed left-[3%] top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
        {pairs.map((_, i) => (
          <button
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-400"
            style={{
              background:
                i === activeIndex
                  ? 'rgba(255,255,255,0.9)'
                  : 'rgba(255,255,255,0.3)',
              transform:
                i === activeIndex ? 'scale(1.3)' : 'scale(1)',
              boxShadow:
                i === activeIndex
                  ? '0 0 8px rgba(255,255,255,0.4)'
                  : 'none',
            }}
            onClick={() => {
              scrollRef.current?.scrollTo({
                top: i * (scrollRef.current?.clientHeight || 0),
                behavior: 'smooth',
              });
            }}
            aria-label={`Go to pair ${i + 1}`}
          />
        ))}
      </div>

      {/* Scrollable sections */}
      <div
        ref={scrollRef}
        className="relative z-10 w-full h-full overflow-y-auto"
        style={{
          scrollSnapType: 'y mandatory',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
        }}
        role="feed"
        aria-label="Profile pairs discovery feed"
      >
        {pairs.map((pair, i) => (
          <PairSection
            key={pair.proposalId}
            pair={pair}
            index={i}
            activeIndex={activeIndex}
            isLast={i === pairs.length - 1}
            reducedMotion={prefersReducedMotion}
            onOpenComments={() => setCommentsOpen(true)}
            onVoteYes={() => handleVoteYes(i)}
            onVoteNo={() => handleVoteNo(i)}
          />
        ))}
      </div>

      {/* Tab overlay panels */}
      <AnimatePresence>
        {activeTab && (
          <>
            <motion.div
              className="fixed inset-0 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ background: 'rgba(0, 0, 0, 0.35)' }}
              onClick={() => setActiveTab(null)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 flex flex-col"
              initial={{ y: '100%' }}
              animate={{ y: '0%' }}
              exit={{ y: '100%' }}
              transition={{
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                height: '80vh',
                borderRadius: '24px 24px 0 0',
                background: 'white',
                border: '1px solid #E5E5EA',
                borderBottom: 'none',
                boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.15)',
                zIndex: 35,
              }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="w-10 h-1 rounded-full"
                  style={{ background: '#D1D1D6' }}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                {activeTab === 'matches' && <MatchesView />}
                {activeTab === 'profile' && <ProfileTab />}
                {activeTab === 'messages' && <DMTab />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <CommentsPanel
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />
    </div>
  );
}
