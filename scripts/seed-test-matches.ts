import { createClient } from '@supabase/supabase-js';
import { keccak256, encodePacked } from 'viem';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ROHAN = '0x001b35aeefc55908811e9bb89b10213feddc6a81';
const maya = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const ava = '0x90f79bf6eb2c4f870365e785982e1f101e93b906';
const sophia = '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc';
const isabella = '0x14dc79964da2c08dda394f80782ef11c7d9283cd';
const olivia = '0xa0ee7a142d267c1f36714e4a8f75612f20a79720';

function ph(a: string, b: string): string {
  const s = [a.toLowerCase(), b.toLowerCase()].sort() as [`0x${string}`, `0x${string}`];
  return keccak256(encodePacked(['address', 'address'], s));
}

async function main() {
  const now = new Date().toISOString();
  const votingStartPast = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const votingExpiryPast = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Clean up Rohan's existing data
  const partners = [maya, ava, sophia, isabella, olivia];
  for (const partner of partners) {
    const hash = ph(ROHAN, partner);
    // Delete conversations referencing these proposals
    const { data: props } = await supabase
      .from('match_proposals')
      .select('id')
      .eq('pair_hash', hash);
    if (props) {
      for (const p of props) {
        await supabase.from('conversation_messages').delete().in(
          'conversation_id',
          (await supabase.from('conversations').select('id').eq('match_proposal_id', p.id)).data?.map(c => c.id) || []
        );
        await supabase.from('conversations').delete().eq('match_proposal_id', p.id);
        await supabase.from('match_votes').delete().eq('match_proposal_id', p.id);
        await supabase.from('voter_assignments').delete().eq('match_proposal_id', p.id);
      }
    }
    await supabase.from('match_proposals').delete().eq('pair_hash', hash);
  }
  console.log('Cleaned up old data');

  async function insertProposal(partner: string, opts: {
    score: number; reasons: string[]; status: string;
    yes: number; no: number; votingStart?: string; votingExpiry?: string;
  }) {
    const sorted = [ROHAN.toLowerCase(), partner.toLowerCase()].sort();
    const isVoting = opts.status === 'voting';
    const { data, error } = await supabase.from('match_proposals').insert({
      user_a_address: sorted[0],
      user_b_address: sorted[1],
      pair_hash: ph(ROHAN, partner),
      ai_compatibility_score: opts.score,
      compatibility_reasons: opts.reasons,
      status: opts.status,
      yes_votes: opts.yes,
      no_votes: opts.no,
      total_votes_cast: opts.yes + opts.no,
      approval_threshold: 5,
      voting_started_at: opts.votingStart || votingStartPast,
      voting_expires_at: opts.votingExpiry || votingExpiryPast,
      finalized_at: isVoting ? null : now,
    }).select().single();
    if (error) console.error('Proposal insert error:', error.message);
    return data;
  }

  // ── 1. APPROVED + BOTH ACCEPTED (can chat): Rohan + Maya ──
  const p1 = await insertProposal(maya, {
    score: 0.92,
    reasons: ['Both love tech', 'Complementary styles', 'Shared goals'],
    status: 'approved', yes: 7, no: 2,
  });
  if (p1) {
    const { data: c1 } = await supabase.from('conversations').insert({
      match_proposal_id: p1.id,
      user_a_address: p1.user_a_address,
      user_b_address: p1.user_b_address,
      user_a_accepted: true,
      user_b_accepted: true,
      unlocked_at: now,
      last_message_at: now,
    }).select().single();
    if (c1) {
      await supabase.from('conversation_messages').insert([
        { conversation_id: c1.id, sender_address: maya, message: 'Hey! The DAO matched us, how cool is that?' },
        { conversation_id: c1.id, sender_address: ROHAN, message: 'I know right! I saw your profile and we have a lot in common' },
        { conversation_id: c1.id, sender_address: maya, message: 'For sure! What got you into Web3?' },
      ]);
    }
    console.log('1. Approved + both accepted + messages (Rohan + Maya Chen)');
  }

  // ── 2. APPROVED: Ava accepted, you haven't: Rohan + Ava ──
  const p2 = await insertProposal(ava, {
    score: 0.87,
    reasons: ['Both creative spirits', 'Love nature', 'Similar values'],
    status: 'approved', yes: 6, no: 3,
  });
  if (p2) {
    const isRohanA = p2.user_a_address === ROHAN;
    await supabase.from('conversations').insert({
      match_proposal_id: p2.id,
      user_a_address: p2.user_a_address,
      user_b_address: p2.user_b_address,
      user_a_accepted: isRohanA ? null : true,
      user_b_accepted: isRohanA ? true : null,
    });
    console.log('2. Approved - Ava accepted, YOU decide (Rohan + Ava Mitchell)');
  }

  // ── 3. APPROVED: neither accepted: Rohan + Sophia ──
  const p3 = await insertProposal(sophia, {
    score: 0.81,
    reasons: ['Music lovers', 'Same city vibes', 'Both adventurous'],
    status: 'approved', yes: 5, no: 4,
  });
  if (p3) {
    await supabase.from('conversations').insert({
      match_proposal_id: p3.id,
      user_a_address: p3.user_a_address,
      user_b_address: p3.user_b_address,
      user_a_accepted: null,
      user_b_accepted: null,
    });
    console.log('3. Approved - neither accepted yet (Rohan + Sophia Reyes)');
  }

  // ── 4. STILL VOTING 4/5 yes: Rohan + Isabella ──
  const p4 = await insertProposal(isabella, {
    score: 0.89,
    reasons: ['Deep thinkers', 'Both love cooking', 'Complementary personalities'],
    status: 'voting', yes: 4, no: 1,
    votingStart: now, votingExpiry: future,
  });
  if (p4) console.log('4. Voting 4/5 yes (Rohan + Isabella Torres) -- needs 1 more!');

  // ── 5. STILL VOTING 2/5 yes: Rohan + Olivia ──
  const p5 = await insertProposal(olivia, {
    score: 0.85,
    reasons: ['Travel enthusiasts', 'Both foodies', 'Shared humor'],
    status: 'voting', yes: 2, no: 1,
    votingStart: now, votingExpiry: future,
  });
  if (p5) console.log('5. Voting 2/5 yes (Rohan + Olivia Andersen) -- early');

  console.log('\nAll test data seeded!');
  console.log('\nWhat you should see:');
  console.log('  Vote tab: proposals #4 and #5 won\'t show (you\'re in the match)');
  console.log('  Matches tab: Maya (matched), Ava (accept/decline), Sophia (accept/decline)');
  console.log('  Messages tab: Maya conversation with 3 messages');
}

main();
