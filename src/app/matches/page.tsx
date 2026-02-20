'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, MessageCircle, ArrowLeft } from 'lucide-react';
import { WalletConnect } from '@/components/WalletConnect';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { getGradientForProfile } from '@/components/MatchVotingScene';

interface ApprovedMatch {
  proposalId: number;
  conversationId: number | null;
  otherUser: {
    name: string;
    age: number;
    location: string;
    initials: string;
    imageUrl: string;
    interests: string[];
    gradientFrom: string;
    gradientTo: string;
  };
  aiScore: number;
  compatibilityReasons: string[];
  userAccepted: boolean | null; // null = pending, true = accepted, false = declined
  otherAccepted: boolean | null;
  status: 'pending_reveal' | 'accepted' | 'declined' | 'mutual_accept' | 'chat_open';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function MatchesPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [matches, setMatches] = useState<ApprovedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      loadApprovedMatches();
    }
  }, [isConnected, address]);

  const loadApprovedMatches = useCallback(async () => {
    if (!address) return;
    try {
      setLoading(true);
      const addr = address.toLowerCase();

      // Get approved proposals where this user is involved
      const { data: proposals, error } = await supabase
        .from('match_proposals')
        .select('*')
        .eq('status', 'approved')
        .or(`user_a_address.eq.${addr},user_b_address.eq.${addr}`);

      if (error) throw error;
      if (!proposals || proposals.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      // Get all other user addresses
      const otherAddresses = proposals.map((p) =>
        p.user_a_address.toLowerCase() === addr ? p.user_b_address : p.user_a_address
      );

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('wallet_address', otherAddresses);

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p) => profileMap.set(p.wallet_address.toLowerCase(), p));

      // Fetch conversations
      const proposalIds = proposals.map((p) => p.id);
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .in('match_proposal_id', proposalIds);

      const convMap = new Map<number, any>();
      (conversations || []).forEach((c) => convMap.set(c.match_proposal_id, c));

      // Build match list
      const approvedMatches: ApprovedMatch[] = [];
      for (const proposal of proposals) {
        const isUserA = proposal.user_a_address.toLowerCase() === addr;
        const otherAddr = isUserA ? proposal.user_b_address : proposal.user_a_address;
        const otherProfile = profileMap.get(otherAddr.toLowerCase());

        if (!otherProfile) continue;

        const conv = convMap.get(proposal.id);
        const gradient = getGradientForProfile(approvedMatches.length);
        const interests = otherProfile.answers_json?.interests || [];

        // Determine acceptance status from conversations table
        // user_a_accepted / user_b_accepted columns (we'll add these)
        const userAccepted = isUserA ? (conv?.user_a_accepted ?? null) : (conv?.user_b_accepted ?? null);
        const otherAccepted = isUserA ? (conv?.user_b_accepted ?? null) : (conv?.user_a_accepted ?? null);

        let status: ApprovedMatch['status'] = 'pending_reveal';
        if (userAccepted === false) {
          status = 'declined';
        } else if (userAccepted === true && otherAccepted === true) {
          status = 'chat_open';
        } else if (userAccepted === true) {
          status = 'accepted';
        }

        approvedMatches.push({
          proposalId: proposal.id,
          conversationId: conv?.id || null,
          otherUser: {
            name: otherProfile.name || 'Anonymous',
            age: otherProfile.age || 0,
            location: otherProfile.location || 'Unknown',
            initials: getInitials(otherProfile.name || 'AN'),
            imageUrl: otherProfile.image_url || '',
            interests: interests.slice(0, 5),
            gradientFrom: gradient.from,
            gradientTo: gradient.to,
          },
          aiScore: parseFloat(proposal.ai_compatibility_score) || 0.8,
          compatibilityReasons: Array.isArray(proposal.compatibility_reasons)
            ? proposal.compatibility_reasons
            : [],
          userAccepted,
          otherAccepted,
          status,
        });
      }

      setMatches(approvedMatches);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  async function handleAcceptDecline(proposalId: number, accept: boolean) {
    if (!address) return;
    setProcessingId(proposalId);

    try {
      const addr = address.toLowerCase();

      // Find the proposal to know which user we are
      const { data: proposal } = await supabase
        .from('match_proposals')
        .select('user_a_address, user_b_address')
        .eq('id', proposalId)
        .single();

      if (!proposal) return;

      const isUserA = proposal.user_a_address.toLowerCase() === addr;
      const field = isUserA ? 'user_a_accepted' : 'user_b_accepted';

      // Update conversation record
      await supabase
        .from('conversations')
        .update({ [field]: accept })
        .eq('match_proposal_id', proposalId);

      // Reload matches
      await loadApprovedMatches();
    } catch (error) {
      console.error('Failed to respond:', error);
    } finally {
      setProcessingId(null);
    }
  }

  // ─── Not connected ──────────────────────────────
  if (!isConnected) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#070b14' }}>
        <motion.div
          className="text-center space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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
          <p className="text-slate-400">Connect to see your approved matches</p>
          <WalletConnect />
        </motion.div>
      </div>
    );
  }

  // ─── Loading ────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#070b14' }}>
        <motion.div className="flex flex-col items-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00ffd5', borderTopColor: 'transparent' }} />
          <p className="text-slate-400 text-sm">Loading your matches...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto" style={{ background: '#070b14' }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.push('/vote')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors mb-6 text-sm"
          >
            <ArrowLeft size={16} />
            Back to Voting
          </button>
          <h1
            className="text-4xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #00ffd5, #22d3ee, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Your Matches
          </h1>
          <p className="text-slate-400 mt-2">
            These matches were approved by the community. Reveal their profile and decide if you want to connect.
          </p>
        </motion.div>

        {/* Match cards */}
        {matches.length === 0 ? (
          <motion.div
            className="text-center glass-strong rounded-2xl p-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="text-4xl mb-4">&#x1F517;</div>
            <h2 className="text-xl font-bold text-white mb-2">No Approved Matches Yet</h2>
            <p className="text-slate-400 text-sm">
              Once the community approves a match you&apos;re part of, it will appear here.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {matches.map((match, index) => (
                <motion.div
                  key={match.proposalId}
                  className="glass-strong rounded-2xl overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="p-6">
                    <div className="flex items-center gap-6">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div
                          className="absolute -inset-2 rounded-full opacity-30 blur-lg"
                          style={{
                            background: `linear-gradient(135deg, ${match.otherUser.gradientFrom}, ${match.otherUser.gradientTo})`,
                          }}
                        />
                        <div className="relative w-20 h-20 rounded-full p-[2px] bg-white/10">
                          {match.otherUser.imageUrl && match.status !== 'pending_reveal' && match.status !== 'declined' ? (
                            <img
                              src={match.otherUser.imageUrl}
                              alt={match.otherUser.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xl"
                              style={{
                                background: `linear-gradient(135deg, ${match.otherUser.gradientFrom}, ${match.otherUser.gradientTo})`,
                              }}
                            >
                              {match.status === 'pending_reveal' ? '?' : match.otherUser.initials}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-white truncate">
                            {match.status === 'pending_reveal'
                              ? 'Mystery Match'
                              : match.otherUser.name}
                          </h3>
                          {/* Status badge */}
                          <span
                            className="text-[10px] font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                            style={{
                              background:
                                match.status === 'chat_open'
                                  ? 'rgba(0,255,213,0.15)'
                                  : match.status === 'accepted'
                                  ? 'rgba(168,85,247,0.15)'
                                  : match.status === 'declined'
                                  ? 'rgba(255,107,107,0.15)'
                                  : 'rgba(255,255,255,0.08)',
                              color:
                                match.status === 'chat_open'
                                  ? '#00ffd5'
                                  : match.status === 'accepted'
                                  ? '#a855f7'
                                  : match.status === 'declined'
                                  ? '#ff6b6b'
                                  : '#94a3b8',
                            }}
                          >
                            {match.status === 'chat_open'
                              ? 'Chat Open'
                              : match.status === 'accepted'
                              ? 'Waiting for Response'
                              : match.status === 'declined'
                              ? 'Declined'
                              : 'New Match'}
                          </span>
                        </div>

                        {match.status !== 'pending_reveal' && (
                          <p className="text-sm text-slate-400 mb-2">
                            {match.otherUser.age} · {match.otherUser.location}
                          </p>
                        )}

                        {/* Compatibility */}
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(0,255,213,0.1)',
                              color: '#00ffd5',
                            }}
                          >
                            {Math.round(match.aiScore * 100)}% Match
                          </span>
                          {match.otherUser.interests.slice(0, 3).map((interest) => (
                            <span
                              key={interest}
                              className="text-[11px] px-2 py-0.5 rounded-full"
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                color: '#94a3b8',
                              }}
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {match.status === 'pending_reveal' && (
                          <>
                            <motion.button
                              className="w-12 h-12 rounded-full flex items-center justify-center"
                              style={{
                                background: 'rgba(255, 107, 107, 0.1)',
                                border: '1px solid rgba(255, 107, 107, 0.3)',
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleAcceptDecline(match.proposalId, false)}
                              disabled={processingId === match.proposalId}
                            >
                              <X size={18} color="#ff6b6b" />
                            </motion.button>
                            <motion.button
                              className="w-12 h-12 rounded-full flex items-center justify-center"
                              style={{
                                background: 'rgba(0, 255, 213, 0.1)',
                                border: '1px solid rgba(0, 255, 213, 0.3)',
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleAcceptDecline(match.proposalId, true)}
                              disabled={processingId === match.proposalId}
                            >
                              <Check size={18} color="#00ffd5" />
                            </motion.button>
                          </>
                        )}
                        {match.status === 'chat_open' && (
                          <motion.button
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                            style={{
                              background: 'rgba(0, 255, 213, 0.15)',
                              border: '1px solid rgba(0, 255, 213, 0.4)',
                              color: '#00ffd5',
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => router.push(`/chat/${match.conversationId}`)}
                          >
                            <MessageCircle size={14} />
                            Chat
                          </motion.button>
                        )}
                        {match.status === 'accepted' && (
                          <div className="text-xs text-slate-500 text-center max-w-[100px]">
                            Waiting for them to accept...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
