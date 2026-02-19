'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { keccak256, encodePacked } from 'viem';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MatchCard } from '@/components/MatchCard';
import { WalletConnect } from '@/components/WalletConnect';
import { supabase } from '@/lib/supabase';
import { zeroGClient } from '@/services/0gComputeClient';
import { CONTRACT_ADDRESSES, MATCH_REGISTRY_ABI } from '@/lib/contracts';
import type { Profile, RankedMatch } from '@/types';

export default function MatchesPage() {
  const { address, isConnected } = useAccount();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<RankedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposingTo, setProposingTo] = useState<string | null>(null);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isTxPending } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConnected && address) {
      loadMatches();
    }
  }, [isConnected, address]);

  async function loadMatches() {
    try {
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', address!.toLowerCase())
        .single();

      if (profileError || !profile) {
        console.error('No profile found');
        setLoading(false);
        return;
      }

      setUserProfile(profile);

      // Fetch all other profiles
      const { data: candidates, error: candidatesError } = await supabase
        .from('profiles')
        .select('*')
        .neq('wallet_address', address!.toLowerCase());

      if (candidatesError || !candidates) {
        console.error('Failed to fetch candidates');
        setLoading(false);
        return;
      }

      // Rank matches
      const ranked = await zeroGClient.rankMatches({
        userEmbedding: profile.embedding as number[],
        candidateEmbeddings: candidates.map((c) => ({
          wallet: c.wallet_address,
          embedding: c.embedding as number[],
        })),
      });

      // Map to full profiles
      const rankedMatches: RankedMatch[] = ranked.slice(0, 5).map((r) => ({
        profile: candidates.find((c) => c.wallet_address === r.wallet)!,
        score: r.score,
      }));

      setMatches(rankedMatches);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePropose(targetWallet: string) {
    if (!userProfile) return;

    setProposingTo(targetWallet);

    try {
      const match = matches.find((m) => m.profile.wallet_address === targetWallet);
      if (!match) return;

      const createdAt = BigInt(Math.floor(Date.now() / 1000));
      const aiScoreHash = keccak256(
        encodePacked(
          ['uint256', 'address', 'address', 'uint64'],
          [BigInt(Math.floor(match.score * 1e18)), address!, targetWallet as `0x${string}`, createdAt]
        )
      );
      const metadataHash = keccak256(
        encodePacked(['string', 'address', 'address'], ['v1', address!, targetWallet as `0x${string}`])
      );

      writeContract({
        address: CONTRACT_ADDRESSES.matchRegistry,
        abi: MATCH_REGISTRY_ABI,
        functionName: 'proposeMatch',
        args: [targetWallet as `0x${string}`, aiScoreHash, metadataHash],
      });
    } catch (error) {
      console.error('Failed to propose match:', error);
      alert('Failed to propose match. Check console for details.');
    } finally {
      setProposingTo(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
            <WalletConnect />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto text-center">
          <p>Loading matches...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="text-center space-y-4">
              <h2 className="text-2xl font-bold">No Profile Found</h2>
              <p className="text-[hsl(var(--muted-foreground))]">
                Create your profile first to see matches.
              </p>
              <Button onClick={() => (window.location.href = '/profile')}>
                Create Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Your Top Matches</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            AI-ranked based on compatibility. Propose a match to start the voting process.
          </p>
        </div>

        {matches.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-center text-[hsl(var(--muted-foreground))]">
                No matches found. Try again later or check back after more profiles are added.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <MatchCard
                key={match.profile.wallet_address}
                match={match}
                onPropose={handlePropose}
                proposing={proposingTo === match.profile.wallet_address || isTxPending}
              />
            ))}
          </div>
        )}

        {txHash && (
          <div className="mt-6 p-4 bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))] rounded-lg">
            <p className="text-sm">
              Transaction submitted! View on{' '}
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Etherscan
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
