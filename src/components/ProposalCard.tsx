'use client';

import { Card, CardContent, CardFooter } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Divider } from './ui/Divider';
import type { MatchProposal, ProposalStatus } from '@/types';

interface ProposalCardProps {
  proposalId: number;
  proposal: MatchProposal;
  userAddress: string;
  canVote: boolean;
  onVote: (proposalId: number, support: boolean) => void;
  onFinalize: (proposalId: number) => void;
  voting?: boolean;
  finalizing?: boolean;
}

const statusLabels: Record<ProposalStatus, string> = {
  [ProposalStatus.OPEN]: 'Open',
  [ProposalStatus.APPROVED]: 'Approved',
  [ProposalStatus.REJECTED]: 'Rejected',
  [ProposalStatus.EXPIRED]: 'Expired',
};

const statusVariants: Record<ProposalStatus, 'default' | 'success' | 'error' | 'warning'> = {
  [ProposalStatus.OPEN]: 'default',
  [ProposalStatus.APPROVED]: 'success',
  [ProposalStatus.REJECTED]: 'error',
  [ProposalStatus.EXPIRED]: 'warning',
};

export function ProposalCard({
  proposalId,
  proposal,
  userAddress,
  canVote,
  onVote,
  onFinalize,
  voting,
  finalizing,
}: ProposalCardProps) {
  const isOpen = proposal.status === ProposalStatus.OPEN;
  const isPastDeadline = Date.now() / 1000 > Number(proposal.deadline);
  const canFinalize = isOpen && isPastDeadline;

  const isParticipant =
    proposal.userA.toLowerCase() === userAddress.toLowerCase() ||
    proposal.userB.toLowerCase() === userAddress.toLowerCase();

  const totalVotes = proposal.yesVotes + proposal.noVotes;
  const yesPercent = totalVotes > 0 ? Math.round((proposal.yesVotes / totalVotes) * 100) : 0;
  const noPercent = totalVotes > 0 ? Math.round((proposal.noVotes / totalVotes) * 100) : 0;

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Match Proposal #{proposalId}</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {proposal.userA.slice(0, 6)}...{proposal.userA.slice(-4)} →{' '}
              {proposal.userB.slice(0, 6)}...{proposal.userB.slice(-4)}
            </p>
          </div>
          <Badge variant={statusVariants[proposal.status]}>
            {statusLabels[proposal.status]}
          </Badge>
        </div>

        {isParticipant && (
          <div className="mb-3">
            <Badge>You're involved in this match</Badge>
          </div>
        )}

        <Divider className="my-4" />

        {/* Vote counts */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span>Yes votes</span>
            <span className="font-semibold">{proposal.yesVotes}</span>
          </div>
          <div className="w-full bg-[hsl(var(--muted))] rounded-full h-2">
            <div
              className="bg-[hsl(var(--success))] h-2 rounded-full transition-all"
              style={{ width: `${yesPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm mt-3">
            <span>No votes</span>
            <span className="font-semibold">{proposal.noVotes}</span>
          </div>
          <div className="w-full bg-[hsl(var(--muted))] rounded-full h-2">
            <div
              className="bg-[hsl(var(--error))] h-2 rounded-full transition-all"
              style={{ width: `${noPercent}%` }}
            />
          </div>
        </div>

        {/* Deadline */}
        {isOpen && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Deadline: {new Date(Number(proposal.deadline) * 1000).toLocaleString()}
          </p>
        )}
      </CardContent>

      <CardFooter>
        {canVote && isOpen && !isPastDeadline && (
          <div className="flex gap-2 w-full">
            <Button
              onClick={() => onVote(proposalId, true)}
              disabled={voting}
              variant="primary"
              className="flex-1"
            >
              Vote Yes
            </Button>
            <Button
              onClick={() => onVote(proposalId, false)}
              disabled={voting}
              variant="outline"
              className="flex-1"
            >
              Vote No
            </Button>
          </div>
        )}

        {canFinalize && (
          <Button
            onClick={() => onFinalize(proposalId)}
            disabled={finalizing}
            className="w-full"
          >
            {finalizing ? 'Finalizing...' : 'Finalize Proposal'}
          </Button>
        )}

        {!canVote && isOpen && !isPastDeadline && (
          <p className="text-sm text-[hsl(var(--muted-foreground))] w-full text-center">
            {!isParticipant ? 'You need DAO tokens to vote' : 'Waiting for DAO votes...'}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
