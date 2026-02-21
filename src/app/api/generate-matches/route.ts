/**
 * POST /api/generate-matches
 *
 * On-demand match generation for infinite voting feed.
 * 1. If the queue has items, promotes them to voting proposals.
 * 2. If the queue is empty, generates new AI-scored matches first.
 * 3. Assigns max 10 random voters per proposal.
 * 4. Returns count of new proposals created.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateMatchPairs } from '@/services/matchmaking/ogMatchmaker';
import { keccak256, encodePacked } from 'viem';

const MAX_VOTERS_PER_PROPOSAL = 10;
const VOTING_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const PROPOSALS_TO_CREATE = 5;

function generatePairHash(userA: string, userB: string): string {
  const addresses = [userA.toLowerCase(), userB.toLowerCase()].sort();
  return keccak256(
    encodePacked(
      ['address', 'address'],
      addresses as [`0x${string}`, `0x${string}`]
    )
  );
}

async function getExistingPairHashes(): Promise<Set<string>> {
  const hashes = new Set<string>();
  const { data: proposals } = await supabase
    .from('match_proposals')
    .select('pair_hash');
  proposals?.forEach((p) => hashes.add(p.pair_hash));

  const { data: queued } = await supabase
    .from('match_generation_queue')
    .select('pair_hash')
    .is('consumed_at', null);
  queued?.forEach((q) => hashes.add(q.pair_hash));

  return hashes;
}

async function assignRandomVoters(
  matchProposalId: number,
  excludeAddresses: string[]
): Promise<number> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('wallet_address')
    .not(
      'wallet_address',
      'in',
      `(${excludeAddresses.map((a) => `"${a}"`).join(',')})`
    );

  const count = Math.min(MAX_VOTERS_PER_PROPOSAL, profiles?.length || 0);
  if (count === 0) return 0;

  const shuffled = (profiles || []).sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);

  const assignments = selected.map((p) => ({
    match_proposal_id: matchProposalId,
    voter_address: p.wallet_address.toLowerCase(),
  }));

  await supabase.from('voter_assignments').insert(assignments);
  return count;
}

async function ensureQueueHasItems(): Promise<number> {
  const { count: queueDepth } = await supabase
    .from('match_generation_queue')
    .select('*', { count: 'exact', head: true })
    .is('consumed_at', null);

  if ((queueDepth || 0) >= PROPOSALS_TO_CREATE) return queueDepth || 0;

  // Generate new matches via 0G AI
  const { data: profiles } = await supabase.from('profiles').select('*');
  if (!profiles || profiles.length < 2) return queueDepth || 0;

  const existingPairs = await getExistingPairHashes();
  const needed = PROPOSALS_TO_CREATE * 2;

  const newPairs = await generateMatchPairs({
    allProfiles: profiles,
    pairsToGenerate: needed,
  });

  const uniquePairs = newPairs.filter((p) => {
    const hash = generatePairHash(p.userA, p.userB);
    return !existingPairs.has(hash);
  });

  if (uniquePairs.length === 0) return queueDepth || 0;

  const toInsert = uniquePairs.slice(0, PROPOSALS_TO_CREATE);
  const queueEntries = toInsert.map((p) => {
    const addresses = [p.userA.toLowerCase(), p.userB.toLowerCase()].sort();
    return {
      user_a_address: addresses[0],
      user_b_address: addresses[1],
      pair_hash: generatePairHash(addresses[0], addresses[1]),
      ai_compatibility_score: p.score,
      compatibility_reasons: p.compatibility,
    };
  });

  await supabase.from('match_generation_queue').insert(queueEntries);
  return (queueDepth || 0) + queueEntries.length;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Ensure queue has items (generates via 0G AI if needed)
    await ensureQueueHasItems();

    // 2. Pull from queue and create proposals
    const { data: queuedMatches } = await supabase
      .from('match_generation_queue')
      .select('*')
      .is('consumed_at', null)
      .order('ai_compatibility_score', { ascending: false })
      .limit(PROPOSALS_TO_CREATE);

    if (!queuedMatches || queuedMatches.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    let created = 0;

    for (const match of queuedMatches) {
      try {
        const { data: proposal, error } = await supabase
          .from('match_proposals')
          .insert({
            user_a_address: match.user_a_address,
            user_b_address: match.user_b_address,
            pair_hash: match.pair_hash,
            ai_compatibility_score: match.ai_compatibility_score,
            compatibility_reasons: match.compatibility_reasons,
            status: 'voting',
            voting_started_at: new Date().toISOString(),
            voting_expires_at: new Date(
              Date.now() + VOTING_DURATION_MS
            ).toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('[generate-matches] Proposal error:', error.message);
          continue;
        }

        // Assign max 10 voters
        await assignRandomVoters(proposal.id, [
          match.user_a_address,
          match.user_b_address,
        ]);

        // Mark consumed
        await supabase
          .from('match_generation_queue')
          .update({ consumed_at: new Date().toISOString() })
          .eq('id', match.id);

        created++;
      } catch (err) {
        console.error('[generate-matches] Error processing match:', err);
      }
    }

    return NextResponse.json({ created });
  } catch (error) {
    console.error('[generate-matches] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate matches' },
      { status: 500 }
    );
  }
}
