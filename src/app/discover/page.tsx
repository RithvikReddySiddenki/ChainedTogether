'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { DiscoveryCard } from '@/components/DiscoveryCard';
import { DiscoverySidebar } from '@/components/DiscoverySidebar';
import type { Profile } from '@/types';

interface MatchPair {
  id: number;
  userA: Profile;
  userB: Profile;
  compatibility: string[];
  aiScore: number;
  gradient: string[];
}

// Soft pastel gradients
const GRADIENTS = [
  ['#7F7FD5', '#C9B6FF', '#F6C7E7'],
  ['#6DD5FA', '#BDEBFF', '#FBE8FF'],
  ['#FBC2EB', '#A6C1EE', '#E4C9F7'],
  ['#A8EDEA', '#D4F1F4', '#FFE6FA'],
  ['#FFD3A5', '#FFA8A8', '#FFCFD3'],
  ['#C2E9FB', '#A1C4FD', '#E8D4F7'],
  ['#F6D365', '#FDA085', '#FFC3A0'],
  ['#B7F8DB', '#50A7C2', '#B4E5F7'],
];

export default function DiscoverPage() {
  const { address, isConnected } = useAccount();
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isConnected && address) {
      loadPairs();
    }
  }, [isConnected, address]);

  async function loadPairs() {
    try {
      // Fetch matches assigned to current user
      const { data: assignments } = await supabase
        .from('voter_assignments')
        .select('match_proposal_id')
        .eq('voter_address', address!.toLowerCase());

      if (!assignments || assignments.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch match proposals
      const matchIds = assignments.map(a => a.match_proposal_id);
      const { data: proposals } = await supabase
        .from('match_proposals')
        .select('*')
        .in('id', matchIds)
        .eq('status', 'voting');

      if (!proposals || proposals.length === 0) {
        setLoading(false);
        return;
      }

      // Load pairs with profiles
      const loadedPairs: MatchPair[] = [];
      for (let i = 0; i < proposals.length; i++) {
        const proposal = proposals[i];

        // Fetch both profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('wallet_address, name, age, location, image_url')
          .in('wallet_address', [proposal.user_a_address, proposal.user_b_address]);

        if (profiles && profiles.length === 2) {
          loadedPairs.push({
            id: proposal.id,
            userA: profiles[0] as any,
            userB: profiles[1] as any,
            compatibility: proposal.compatibility_reasons || [
              'Shared interests',
              'Similar values',
              'Compatible lifestyle',
            ],
            aiScore: proposal.ai_compatibility_score || 0.85,
            gradient: GRADIENTS[i % GRADIENTS.length],
          });
        }
      }

      setPairs(loadedPairs);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load pairs:', error);
      setLoading(false);
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const windowHeight = window.innerHeight;
      const newIndex = Math.round(scrollTop / windowHeight);
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < pairs.length) {
        setCurrentIndex(newIndex);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [currentIndex, pairs.length]);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Connect to discover</h2>
          <p className="text-gray-600">Connect your wallet to start exploring</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
        <div className="text-center">
          <div className="animate-pulse text-gray-600">Loading your matches...</div>
        </div>
      </div>
    );
  }

  if (pairs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold mb-4">All caught up</h2>
          <p className="text-gray-600">
            No new matches to discover right now. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  const currentPair = pairs[currentIndex];

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Dynamic gradient background */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="absolute inset-0 -z-10"
          style={{
            background: `linear-gradient(135deg, ${currentPair.gradient.join(', ')})`,
          }}
        />
      </AnimatePresence>

      {/* Sidebar */}
      <DiscoverySidebar activeSection={currentIndex} totalSections={pairs.length} />

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {pairs.map((pair, index) => (
          <section
            key={pair.id}
            className="h-screen w-full snap-start flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0.6 }}
              animate={{
                opacity: index === currentIndex ? 1 : 0.6,
                y: index === currentIndex ? 0 : 20,
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex items-center justify-center gap-[120px]"
            >
              {/* User A Card */}
              <DiscoveryCard
                profile={pair.userA}
                compatibility={pair.compatibility}
                onVote={(support) => handleVote(pair.id, support)}
              />

              {/* User B Card */}
              <DiscoveryCard
                profile={pair.userB}
                compatibility={pair.compatibility}
                onVote={(support) => handleVote(pair.id, support)}
              />
            </motion.div>

            {/* Scroll indicator */}
            {index < pairs.length - 1 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  repeatType: 'reverse',
                }}
                className="absolute bottom-12 left-1/2 -translate-x-1/2"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </motion.div>
            )}
          </section>
        ))}
      </div>

      {/* Match counter */}
      <div className="fixed top-8 right-8 text-white/80 text-sm font-medium backdrop-blur-sm bg-white/10 px-4 py-2 rounded-full">
        {currentIndex + 1} / {pairs.length}
      </div>
    </div>
  );

  async function handleVote(matchId: number, support: boolean) {
    // TODO: Implement voting logic
    console.log(`Voted ${support ? 'YES' : 'NO'} on match ${matchId}`);

    // For now, just scroll to next
    if (containerRef.current && currentIndex < pairs.length - 1) {
      containerRef.current.scrollTo({
        top: (currentIndex + 1) * window.innerHeight,
        behavior: 'smooth',
      });
    }
  }
}
