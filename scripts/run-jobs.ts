#!/usr/bin/env node

/**
 * Background jobs runner with environment loading
 * Run with: npm run jobs
 */

// Load environment variables FIRST
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from root directory
dotenv.config({ path: resolve(__dirname, '../.env') });

console.log('🔧 Environment loaded');
console.log(`   Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗'}`);
console.log(`   Supabase Key: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗'}`);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('\n❌ Missing Supabase environment variables!');
  console.error('   Make sure .env file exists with:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Now import the jobs module (after env is loaded)
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - importing from relative path
import { generateMatchPairs } from '../src/services/matchmaking/ogMatchmaker';
import { keccak256, encodePacked } from 'viem';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =====================================================
// HELPER FUNCTIONS (Copied from matchLifecycleJobs.ts)
// =====================================================

function generatePairHash(userA: string, userB: string): string {
  const addresses = [userA.toLowerCase(), userB.toLowerCase()].sort();
  return keccak256(encodePacked(['address', 'address'], addresses as [`0x${string}`, `0x${string}`]));
}

async function getExistingPairHashes(): Promise<Set<string>> {
  const hashes = new Set<string>();

  // Check ALL proposals (any status) — the pair_hash column has a UNIQUE constraint
  const { data: proposals } = await supabase
    .from('match_proposals')
    .select('pair_hash');

  proposals?.forEach(p => hashes.add(p.pair_hash));

  // Also check unconsumed queue entries
  const { data: queued } = await supabase
    .from('match_generation_queue')
    .select('pair_hash')
    .is('consumed_at', null);

  queued?.forEach(q => hashes.add(q.pair_hash));

  return hashes;
}

async function assignRandomVoters(
  matchProposalId: number,
  count: number,
  excludeAddresses: string[]
): Promise<string[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('wallet_address')
    .not('wallet_address', 'in', `(${excludeAddresses.map(a => `"${a}"`).join(',')})`);

  if (!profiles || profiles.length < count) {
    console.warn(`Not enough voters available. Need ${count}, have ${profiles?.length || 0}`);
    count = Math.min(count, profiles?.length || 0);
  }

  const shuffled = profiles.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);

  const assignments = selected.map(p => ({
    match_proposal_id: matchProposalId,
    voter_address: p.wallet_address.toLowerCase(),
  }));

  await supabase.from('voter_assignments').insert(assignments);

  return selected.map(p => p.wallet_address);
}

// =====================================================
// JOBS
// =====================================================

async function matchGeneratorJob() {
  console.log('[MatchGenerator] Starting...');

  try {
    const { data: queueData, count: queueDepth } = await supabase
      .from('match_generation_queue')
      .select('*', { count: 'exact', head: true })
      .is('consumed_at', null);

    console.log(`[MatchGenerator] Queue depth: ${queueDepth}`);

    const targetDepth = 75;
    const minDepth = 50;

    if ((queueDepth || 0) < minDepth) {
      const needed = targetDepth - (queueDepth || 0);
      console.log(`[MatchGenerator] Generating ${needed} new matches...`);

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*');

      if (profileError || !profiles || profiles.length < 2) {
        console.error('[MatchGenerator] Not enough profiles:', profileError);
        return;
      }

      console.log(`[MatchGenerator] Found ${profiles.length} profiles`);

      const existingPairs = await getExistingPairHashes();
      console.log(`[MatchGenerator] Existing pairs: ${existingPairs.size}`);

      const newPairs = await generateMatchPairs({
        allProfiles: profiles,
        pairsToGenerate: needed * 2,
      });

      const uniquePairs = newPairs.filter(p => {
        const hash = generatePairHash(p.userA, p.userB);
        return !existingPairs.has(hash);
      });

      if (uniquePairs.length === 0) {
        console.log('[MatchGenerator] No new unique pairs available');
        return;
      }

      const toInsert = uniquePairs.slice(0, needed);

      const queueEntries = toInsert.map(p => {
        const addresses = [p.userA.toLowerCase(), p.userB.toLowerCase()].sort();
        return {
          user_a_address: addresses[0],
          user_b_address: addresses[1],
          pair_hash: generatePairHash(addresses[0], addresses[1]),
          ai_compatibility_score: p.score,
          compatibility_reasons: p.compatibility,
        };
      });

      const { error: insertError } = await supabase
        .from('match_generation_queue')
        .insert(queueEntries);

      if (insertError) {
        console.error('[MatchGenerator] Insert error:', insertError);
      } else {
        console.log(`[MatchGenerator] ✓ Generated ${queueEntries.length} new matches`);
      }
    } else {
      console.log('[MatchGenerator] Queue sufficient, skipping generation');
    }
  } catch (error) {
    console.error('[MatchGenerator] Error:', error);
  }
}

async function proposalCreatorJob() {
  console.log('[ProposalCreator] Starting...');

  try {
    const { count: activeVoting } = await supabase
      .from('match_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'voting');

    console.log(`[ProposalCreator] Active voting: ${activeVoting}`);

    const targetActive = 12;
    const minActive = 10;

    if ((activeVoting || 0) < minActive) {
      const needed = targetActive - (activeVoting || 0);
      console.log(`[ProposalCreator] Need ${needed} more proposals`);

      const { data: queuedMatches } = await supabase
        .from('match_generation_queue')
        .select('*')
        .is('consumed_at', null)
        .order('ai_compatibility_score', { ascending: false })
        .order('generated_at', { ascending: true })
        .limit(needed);

      if (!queuedMatches || queuedMatches.length === 0) {
        console.log('[ProposalCreator] Queue is empty!');
        return;
      }

      console.log(`[ProposalCreator] Processing ${queuedMatches.length} matches`);

      for (const match of queuedMatches) {
        try {
          const { data: proposal, error: proposalError } = await supabase
            .from('match_proposals')
            .insert({
              user_a_address: match.user_a_address,
              user_b_address: match.user_b_address,
              pair_hash: match.pair_hash,
              ai_compatibility_score: match.ai_compatibility_score,
              compatibility_reasons: match.compatibility_reasons,
              status: 'voting',
              voting_started_at: new Date().toISOString(),
              voting_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            })
            .select()
            .single();

          if (proposalError) {
            console.error('[ProposalCreator] Proposal creation error:', proposalError);
            continue;
          }

          console.log(`[ProposalCreator] Created proposal ${proposal.id}`);

          const voters = await assignRandomVoters(
            proposal.id,
            10,
            [match.user_a_address, match.user_b_address]
          );

          console.log(`[ProposalCreator] Assigned ${voters.length} voters`);

          await supabase
            .from('match_generation_queue')
            .update({ consumed_at: new Date().toISOString() })
            .eq('id', match.id);

          console.log(`[ProposalCreator] ✓ Proposal ${proposal.id} ready`);
        } catch (error) {
          console.error('[ProposalCreator] Error processing match:', error);
        }
      }
    } else {
      console.log('[ProposalCreator] Sufficient active proposals');
    }
  } catch (error) {
    console.error('[ProposalCreator] Error:', error);
  }
}

async function expirationHandlerJob() {
  console.log('[ExpirationHandler] Starting...');

  try {
    const { data: expired } = await supabase
      .from('match_proposals')
      .select('*')
      .eq('status', 'voting')
      .lt('voting_expires_at', new Date().toISOString());

    if (!expired || expired.length === 0) {
      console.log('[ExpirationHandler] No expired proposals');
      return;
    }

    console.log(`[ExpirationHandler] Found ${expired.length} expired proposals`);

    for (const proposal of expired) {
      try {
        let newStatus: string;
        if (proposal.yes_votes >= proposal.approval_threshold) {
          newStatus = 'approved';
        } else if (proposal.yes_votes > proposal.no_votes) {
          newStatus = 'approved';
        } else {
          newStatus = 'rejected';
        }

        await supabase
          .from('match_proposals')
          .update({
            status: newStatus,
            finalized_at: new Date().toISOString(),
          })
          .eq('id', proposal.id);

        console.log(`[ExpirationHandler] Finalized proposal ${proposal.id}: ${newStatus}`);

        if (newStatus === 'approved') {
          await supabase
            .from('conversations')
            .insert({
              match_proposal_id: proposal.id,
              user_a_address: proposal.user_a_address,
              user_b_address: proposal.user_b_address,
            });

          console.log(`[ExpirationHandler] ✓ Created conversation for proposal ${proposal.id}`);
        }
      } catch (error) {
        console.error(`[ExpirationHandler] Error finalizing ${proposal.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[ExpirationHandler] Error:', error);
  }
}

// =====================================================
// SCHEDULER
// =====================================================

function startJobs() {
  console.log('\n🚀 Starting ChainedTogether background jobs...\n');

  // Run immediately
  matchGeneratorJob();
  proposalCreatorJob();

  // Match Generator: Every 5 minutes
  setInterval(matchGeneratorJob, 5 * 60 * 1000);

  // Proposal Creator: Every 1 minute
  setInterval(proposalCreatorJob, 1 * 60 * 1000);

  // Expiration Handler: Every 1 minute
  setInterval(expirationHandlerJob, 1 * 60 * 1000);

  console.log('✓ All background jobs scheduled\n');
  console.log('Press Ctrl+C to stop\n');
}

// Start jobs
startJobs();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down background jobs...');
  process.exit(0);
});
