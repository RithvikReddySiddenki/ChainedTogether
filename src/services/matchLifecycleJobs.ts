/**
 * Background jobs for continuous match lifecycle management
 *
 * Run with: node --loader ts-node/esm src/services/matchLifecycleJobs.ts
 * Or integrate with your deployment (PM2, systemd, etc.)
 */

import { supabase } from '@/lib/supabase';
import { zeroGClient } from './0gComputeClient';
import { keccak256, encodePacked } from 'viem';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function generatePairHash(userA: string, userB: string): string {
  const addresses = [userA.toLowerCase(), userB.toLowerCase()].sort();
  return keccak256(encodePacked(['address', 'address'], addresses as [`0x${string}`, `0x${string}`]));
}

async function getExistingPairHashes(): Promise<Set<string>> {
  const hashes = new Set<string>();

  // From proposals
  const { data: proposals } = await supabase
    .from('match_proposals')
    .select('pair_hash')
    .in('status', ['proposed', 'voting', 'approved']);

  proposals?.forEach(p => hashes.add(p.pair_hash));

  // From queue
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
  // Get all eligible profiles (excluding the matched pair)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('wallet_address')
    .not('wallet_address', 'in', `(${excludeAddresses.map(a => `"${a}"`).join(',')})`);

  if (!profiles || profiles.length < count) {
    console.warn(`Not enough voters available. Need ${count}, have ${profiles?.length || 0}`);
    // Assign as many as possible
    count = Math.min(count, profiles?.length || 0);
  }

  // Shuffle and take first N
  const shuffled = (profiles || []).sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);

  // Insert assignments
  const assignments = selected.map(p => ({
    match_proposal_id: matchProposalId,
    voter_address: p.wallet_address.toLowerCase(),
  }));

  await supabase.from('voter_assignments').insert(assignments);

  return selected.map(p => p.wallet_address);
}

// =====================================================
// JOB 1: MATCH GENERATOR
// =====================================================

export async function matchGeneratorJob() {
  console.log('[MatchGenerator] Starting...');

  try {
    // Check queue depth
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

      // Fetch all profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*');

      if (profileError || !profiles || profiles.length < 2) {
        console.error('[MatchGenerator] Not enough profiles:', profileError);
        return;
      }

      console.log(`[MatchGenerator] Found ${profiles.length} profiles`);

      // Get existing pairs
      const existingPairs = await getExistingPairHashes();
      console.log(`[MatchGenerator] Existing pairs: ${existingPairs.size}`);

      // Generate new pairs
      const newPairs = await zeroGClient.generateMatchPairs({
        allProfiles: profiles,
        pairsToGenerate: needed * 2, // Generate more, filter duplicates
      });

      // Filter out duplicates
      const uniquePairs = newPairs.filter(p => {
        const hash = generatePairHash(p.userA, p.userB);
        return !existingPairs.has(hash);
      });

      if (uniquePairs.length === 0) {
        console.log('[MatchGenerator] No new unique pairs available');
        return;
      }

      // Take only what we need
      const toInsert = uniquePairs.slice(0, needed);

      // Prepare inserts
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

      // Insert into queue
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

// =====================================================
// JOB 2: PROPOSAL CREATOR
// =====================================================

export async function proposalCreatorJob() {
  console.log('[ProposalCreator] Starting...');

  try {
    // Check active voting count
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

      // Pull from queue
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
          // Create proposal
          const { data: proposal, error: proposalError } = await supabase
            .from('match_proposals')
            .insert({
              user_a_address: match.user_a_address,
              user_b_address: match.user_b_address,
              pair_hash: match.pair_hash,
              ai_compatibility_score: match.ai_compatibility_score,
              compatibility_reasons: match.compatibility_reasons,
              status: 'voting', // Go directly to voting for demo
              voting_started_at: new Date().toISOString(),
              voting_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
            })
            .select()
            .single();

          if (proposalError) {
            console.error('[ProposalCreator] Proposal creation error:', proposalError);
            continue;
          }

          console.log(`[ProposalCreator] Created proposal ${proposal.id}`);

          // Assign voters
          const voters = await assignRandomVoters(
            proposal.id,
            10,
            [match.user_a_address, match.user_b_address]
          );

          console.log(`[ProposalCreator] Assigned ${voters.length} voters`);

          // Mark queue entry as consumed
          await supabase
            .from('match_generation_queue')
            .update({ consumed_at: new Date().toISOString() })
            .eq('id', match.id);

          // TODO: Create on-chain proposal here
          // const txHash = await createOnChainProposal(proposal.id);
          // await supabase
          //   .from('match_proposals')
          //   .update({ on_chain_tx_hash: txHash })
          //   .eq('id', proposal.id);

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

// =====================================================
// JOB 3: EXPIRATION HANDLER
// =====================================================

export async function expirationHandlerJob() {
  console.log('[ExpirationHandler] Starting...');

  try {
    // Find expired proposals
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
        // Determine outcome
        let newStatus: string;
        if (proposal.yes_votes >= proposal.approval_threshold) {
          newStatus = 'approved';
        } else if (proposal.yes_votes > proposal.no_votes) {
          newStatus = 'approved'; // Majority yes
        } else {
          newStatus = 'rejected';
        }

        // Update proposal
        await supabase
          .from('match_proposals')
          .update({
            status: newStatus,
            finalized_at: new Date().toISOString(),
          })
          .eq('id', proposal.id);

        console.log(`[ExpirationHandler] Finalized proposal ${proposal.id}: ${newStatus}`);

        // If approved, create conversation
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
// JOB 4: QUEUE CLEANUP
// =====================================================

export async function queueCleanupJob() {
  console.log('[QueueCleanup] Starting...');

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const { error } = await supabase
      .from('match_generation_queue')
      .delete()
      .lt('consumed_at', cutoff.toISOString())
      .not('consumed_at', 'is', null);

    if (error) {
      console.error('[QueueCleanup] Error:', error);
    } else {
      console.log('[QueueCleanup] ✓ Cleaned up old queue entries');
    }
  } catch (error) {
    console.error('[QueueCleanup] Error:', error);
  }
}

// =====================================================
// JOB 5: SYSTEM METRICS
// =====================================================

export async function systemMetricsJob() {
  console.log('[SystemMetrics] Recording...');

  try {
    const metrics = [];

    // Queue depth
    const { count: queueDepth } = await supabase
      .from('match_generation_queue')
      .select('*', { count: 'exact', head: true })
      .is('consumed_at', null);

    metrics.push({ metric_name: 'queue_depth', metric_value: queueDepth || 0 });

    // Active voting
    const { count: activeVoting } = await supabase
      .from('match_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'voting');

    metrics.push({ metric_name: 'active_voting', metric_value: activeVoting || 0 });

    // Approved today
    const { count: approvedToday } = await supabase
      .from('match_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gte('finalized_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    metrics.push({ metric_name: 'approved_today', metric_value: approvedToday || 0 });

    // Insert metrics
    await supabase.from('system_metrics').insert(metrics);

    console.log('[SystemMetrics] ✓ Recorded metrics');
  } catch (error) {
    console.error('[SystemMetrics] Error:', error);
  }
}

// =====================================================
// JOB SCHEDULER
// =====================================================

export function startJobs() {
  console.log('🚀 Starting background jobs...');

  // Run immediately on startup
  matchGeneratorJob();
  proposalCreatorJob();

  // Match Generator: Every 5 minutes
  setInterval(matchGeneratorJob, 5 * 60 * 1000);

  // Proposal Creator: Every 1 minute
  setInterval(proposalCreatorJob, 1 * 60 * 1000);

  // Expiration Handler: Every 1 minute
  setInterval(expirationHandlerJob, 1 * 60 * 1000);

  // Queue Cleanup: Daily at 3 AM (simplified: every 24 hours)
  setInterval(queueCleanupJob, 24 * 60 * 60 * 1000);

  // System Metrics: Every 5 minutes
  setInterval(systemMetricsJob, 5 * 60 * 1000);

  console.log('✓ All background jobs scheduled');
}

// Start if run directly
if (require.main === module) {
  startJobs();
}
