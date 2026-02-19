'use client';

import { Card, CardContent, CardFooter } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import type { RankedMatch } from '@/types';

interface MatchCardProps {
  match: RankedMatch;
  onPropose: (walletAddress: string) => void;
  proposing?: boolean;
}

export function MatchCard({ match, onPropose, proposing }: MatchCardProps) {
  const { profile, score } = match;
  const matchPercentage = Math.round(score * 100);

  return (
    <Card>
      <CardContent className="flex gap-4">
        {/* Image */}
        <div className="flex-shrink-0">
          <img
            src={profile.image_url}
            alt={profile.name}
            className="w-24 h-24 rounded-lg object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="text-lg font-semibold">{profile.name}</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {profile.age} • {profile.location}
              </p>
            </div>
            <Badge variant="success">{matchPercentage}% Match</Badge>
          </div>

          {/* Note: We intentionally DON'T show answers_json to matches */}
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
            AI has identified this as a strong potential match based on your profile.
          </p>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={() => onPropose(profile.wallet_address)}
          disabled={proposing}
          className="w-full"
        >
          {proposing ? 'Proposing...' : 'Propose Match'}
        </Button>
      </CardFooter>
    </Card>
  );
}
