'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card, CardContent } from '@/components/ui/Card';
import { WalletConnect } from '@/components/WalletConnect';
import { ProposalCard } from '@/components/ProposalCard';
import { CONTRACT_ADDRESSES, MATCH_REGISTRY_ABI } from '@/lib/contracts';
import type { MatchProposal } from '@/types';

export default function ProposalsPage() {
  const { address, isConnected } = useAccount();
  const [proposals, setProposals] = useState<Array<{ id: number; proposal: MatchProposal }>>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isTxPending } = useWaitForTransactionReceipt({ hash: txHash });

  // Proposal count - loaded from Supabase instead of contract
  const proposalCount = 0;

  useEffect(() => {
    if (isConnected) {
      loadProposals();
    }
  }, [isConnected]);

  async function loadProposals() {
    try {
      const count = Number(proposalCount || 0);
      const allProposals: Array<{ id: number; proposal: MatchProposal }> = [];

      // Fetch all proposals (in production, use events/indexer)
      for (let i = 0; i < count; i++) {
        // This would normally use useReadContract but for simplicity we'll show the pattern
        // In real implementation, batch these reads or use events
        allProposals.push({
          id: i,
          proposal: {
            userA: '0x...',
            userB: '0x...',
            aiScoreHash: '0x...',
            metadataHash: '0x...',
            createdAt: BigInt(0),
            deadline: BigInt(0),
            yesVotes: 0,
            noVotes: 0,
            status: 0,
          } as MatchProposal,
        });
      }

      // Filter to proposals involving current user
      const userProposals = allProposals.filter(
        (p) =>
          p.proposal.userA.toLowerCase() === address?.toLowerCase() ||
          p.proposal.userB.toLowerCase() === address?.toLowerCase()
      );

      setProposals(userProposals);
    } catch (error) {
      console.error('Failed to load proposals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(proposalId: number, support: boolean) {
    setVoting(true);
    try {
      writeContract({
        address: CONTRACT_ADDRESSES.matchRegistry,
        abi: MATCH_REGISTRY_ABI,
        functionName: 'vote',
        args: [BigInt(proposalId), support],
      });
    } catch (error) {
      console.error('Failed to vote:', error);
      alert('Failed to vote. Check console for details.');
    } finally {
      setVoting(false);
    }
  }

  async function handleFinalize(proposalId: number) {
    setFinalizing(true);
    try {
      writeContract({
        address: CONTRACT_ADDRESSES.matchRegistry,
        abi: MATCH_REGISTRY_ABI,
        functionName: 'finalize',
        args: [BigInt(proposalId)],
      });
    } catch (error) {
      console.error('Failed to finalize:', error);
      alert('Failed to finalize. Check console for details.');
    } finally {
      setFinalizing(false);
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
          <p>Loading proposals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Match Proposals</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Vote on proposals or finalize them after the deadline.
          </p>
        </div>

        {proposals.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-center text-[hsl(var(--muted-foreground))]">
                No proposals found involving you. Create a match proposal first!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {proposals.map(({ id, proposal }) => (
              <ProposalCard
                key={id}
                proposalId={id}
                proposal={proposal}
                userAddress={address!}
                canVote={false} // TODO: Implement canVote check
                onVote={handleVote}
                onFinalize={handleFinalize}
                voting={voting || isTxPending}
                finalizing={finalizing || isTxPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
