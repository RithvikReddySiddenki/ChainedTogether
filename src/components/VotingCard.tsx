'use client';

import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Divider } from './ui/Divider';
import type { Profile } from '@/types';

interface VotingCardProps {
  matchId: number;
  userA: Profile;
  userB: Profile;
  compatibility: string[];
  aiScore: number;
  onVote: (matchId: number, support: boolean) => void;
  voting?: boolean;
}

export function VotingCard({
  matchId,
  userA,
  userB,
  compatibility,
  aiScore,
  onVote,
  voting,
}: VotingCardProps) {
  const matchPercentage = Math.round(aiScore * 100);

  return (
    <Card className="max-w-4xl mx-auto">
      <CardContent>
        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold mb-2">Potential Match #{matchId}</h3>
          <Badge variant="success" className="text-lg px-4 py-1">
            {matchPercentage}% AI Compatibility
          </Badge>
        </div>

        {/* Two Profiles Side by Side */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* User A */}
          <div className="text-center">
            <img
              src={userA.image_url}
              alt={userA.name}
              className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
            />
            <h4 className="text-xl font-semibold">{userA.name}</h4>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {userA.age} • {userA.location}
            </p>
          </div>

          {/* Divider with heart */}
          <div className="hidden md:flex items-center justify-center">
            <div className="text-4xl">💕</div>
          </div>

          {/* User B */}
          <div className="text-center md:col-start-2">
            <img
              src={userB.image_url}
              alt={userB.name}
              className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
            />
            <h4 className="text-xl font-semibold">{userB.name}</h4>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {userB.age} • {userB.location}
            </p>
          </div>
        </div>

        <Divider className="my-6" />

        {/* Compatibility Reasons */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3 text-center">Why They Match</h4>
          <div className="space-y-2">
            {compatibility.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-[hsl(var(--accent))]">✓</span>
                <span className="text-sm">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        <Divider className="my-6" />

        {/* Voting Question */}
        <div className="text-center mb-6">
          <p className="text-lg font-medium">Do you think they would make a good match?</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Your vote helps the community decide if this match should happen
          </p>
        </div>

        {/* Vote Buttons */}
        <div className="flex gap-4 max-w-md mx-auto">
          <Button
            onClick={() => onVote(matchId, false)}
            disabled={voting}
            variant="outline"
            size="lg"
            className="flex-1 border-2 hover:border-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/10"
          >
            <span className="text-2xl mr-2">👎</span>
            No
          </Button>
          <Button
            onClick={() => onVote(matchId, true)}
            disabled={voting}
            size="lg"
            className="flex-1 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/80"
          >
            <span className="text-2xl mr-2">👍</span>
            Yes
          </Button>
        </div>

        {voting && (
          <div className="text-center mt-4 text-sm text-[hsl(var(--muted-foreground))]">
            Submitting your vote...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
