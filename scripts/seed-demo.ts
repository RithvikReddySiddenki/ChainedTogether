import { createClient } from '@supabase/supabase-js';
import { keccak256, encodePacked } from 'viem';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Real users
const ROHAN = '0x001b35aeefc55908811e9bb89b10213feddc6a81';
const RITHVIK = '0x249104cea7f0cfd3d3af95706d22150e8899bdcb';

// Fake wallet addresses (deterministic, lowercase)
const FAKE_WALLETS = {
  emma:   '0xf000000000000000000000000000000000000001',
  liam:   '0xf000000000000000000000000000000000000002',
  olivia: '0xf000000000000000000000000000000000000003',
  noah:   '0xf000000000000000000000000000000000000004',
  ava:    '0xf000000000000000000000000000000000000005',
  ethan:  '0xf000000000000000000000000000000000000006',
  mia:    '0xf000000000000000000000000000000000000007',
  lucas:  '0xf000000000000000000000000000000000000008',
  sophia: '0xf000000000000000000000000000000000000009',
  james:  '0xf00000000000000000000000000000000000000a',
};

function pairHash(a: string, b: string): string {
  const sorted = [a.toLowerCase(), b.toLowerCase()].sort() as [`0x${string}`, `0x${string}`];
  return keccak256(encodePacked(['address', 'address'], sorted));
}

function sortPair(a: string, b: string): [string, string] {
  return [a.toLowerCase(), b.toLowerCase()].sort() as [string, string];
}

// --- NUKE ALL PAIRING DATA ---
async function nukeAllData() {
  console.log('Nuking all pairing data...');

  await supabase.from('conversation_messages').delete().neq('id', 0);
  console.log('  conversation_messages: cleared');

  await supabase.from('conversations').delete().neq('id', 0);
  console.log('  conversations: cleared');

  await supabase.from('match_votes').delete().neq('id', 0);
  console.log('  match_votes: cleared');

  await supabase.from('voter_assignments').delete().neq('id', 0);
  console.log('  voter_assignments: cleared');

  await supabase.from('match_proposals').delete().neq('id', 0);
  console.log('  match_proposals: cleared');

  await supabase.from('match_generation_queue').delete().neq('id', 0);
  console.log('  match_generation_queue: cleared');

  // Delete fake profiles (keep real Rohan/Rithvik profiles)
  const fakeAddresses = Object.values(FAKE_WALLETS);
  await supabase.from('profiles').delete().in('wallet_address', fakeAddresses);
  console.log('  fake profiles: cleared');

  console.log('All pairing data nuked.\n');
}

// --- CREATE FAKE PROFILES ---
async function createFakeProfiles() {
  console.log('Creating fake profiles...');

  const profiles = [
    { wallet_address: FAKE_WALLETS.emma, name: 'Emma Chen', age: 22, location: 'San Francisco', bio: 'ML engineer who loves hiking and matcha lattes', image_url: 'https://randomuser.me/api/portraits/women/44.jpg' },
    { wallet_address: FAKE_WALLETS.liam, name: 'Liam Patel', age: 23, location: 'Austin', bio: 'Full-stack dev, DeFi enthusiast, amateur chef', image_url: 'https://randomuser.me/api/portraits/men/32.jpg' },
    { wallet_address: FAKE_WALLETS.olivia, name: 'Olivia Kim', age: 21, location: 'New York', bio: 'Art history major turned NFT curator', image_url: 'https://randomuser.me/api/portraits/women/68.jpg' },
    { wallet_address: FAKE_WALLETS.noah, name: 'Noah Garcia', age: 24, location: 'Chicago', bio: 'Smart contract auditor, rock climbing addict', image_url: 'https://randomuser.me/api/portraits/men/75.jpg' },
    { wallet_address: FAKE_WALLETS.ava, name: 'Ava Mitchell', age: 22, location: 'Seattle', bio: 'UX designer for DAOs, plant mom', image_url: 'https://randomuser.me/api/portraits/women/17.jpg' },
    { wallet_address: FAKE_WALLETS.ethan, name: 'Ethan Wright', age: 23, location: 'Denver', bio: 'Protocol engineer, snowboard instructor', image_url: 'https://randomuser.me/api/portraits/men/86.jpg' },
    { wallet_address: FAKE_WALLETS.mia, name: 'Mia Johnson', age: 21, location: 'Portland', bio: 'Community manager, vinyl collector, cat person', image_url: 'https://randomuser.me/api/portraits/women/90.jpg' },
    { wallet_address: FAKE_WALLETS.lucas, name: 'Lucas Brown', age: 24, location: 'Miami', bio: 'Tokenomics researcher, beach volleyball player', image_url: 'https://randomuser.me/api/portraits/men/11.jpg' },
    { wallet_address: FAKE_WALLETS.sophia, name: 'Sophia Reyes', age: 22, location: 'LA', bio: 'ZK researcher, amateur DJ, always at hackathons', image_url: 'https://randomuser.me/api/portraits/women/55.jpg' },
    { wallet_address: FAKE_WALLETS.james, name: 'James Lee', age: 23, location: 'Boston', bio: 'Governance nerd, marathon runner, tea lover', image_url: 'https://randomuser.me/api/portraits/men/94.jpg' },
  ];

  for (const p of profiles) {
    const { error } = await supabase.from('profiles').upsert(p, { onConflict: 'wallet_address' });
    if (error) console.error(`  Error creating ${p.name}:`, error.message);
    else console.log(`  Created: ${p.name}`);
  }
  console.log('');
}

// --- SEED ROHAN + RITHVIK APPROVED MATCH ---
async function seedRohanRithvikMatch() {
  console.log('Seeding Rohan + Rithvik approved match...');

  const [userA, userB] = sortPair(ROHAN, RITHVIK);
  const hash = pairHash(ROHAN, RITHVIK);
  const now = new Date().toISOString();

  const { data: proposal, error: propError } = await supabase
    .from('match_proposals')
    .insert({
      user_a_address: userA,
      user_b_address: userB,
      pair_hash: hash,
      ai_compatibility_score: 0.91,
      compatibility_reasons: ['Both passionate about blockchain', 'Shared love of building cool projects', 'Complementary skill sets'],
      status: 'approved',
      yes_votes: 7,
      no_votes: 2,
      total_votes_cast: 9,
      approval_threshold: 5,
      voting_started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      voting_expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      finalized_at: now,
    })
    .select()
    .single();

  if (propError) {
    console.error('  Proposal error:', propError.message);
    return;
  }

  console.log(`  Proposal created (id: ${proposal.id}, status: approved)`);

  const { error: convError } = await supabase
    .from('conversations')
    .insert({
      match_proposal_id: proposal.id,
      user_a_address: userA,
      user_b_address: userB,
      user_a_accepted: null,
      user_b_accepted: null,
    });

  if (convError) {
    console.error('  Conversation error:', convError.message);
  } else {
    console.log('  Conversation created (neither accepted yet)');
  }
  console.log('');
}

// --- SEED VOTING FEED PAIRS ---
async function seedVotingFeed() {
  console.log('Seeding voting feed pairs...');

  const now = new Date();
  const votingStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const votingExpiry = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  const votingPairs = [
    {
      a: FAKE_WALLETS.emma, b: FAKE_WALLETS.liam,
      score: 0.88, reasons: ['Both tech-savvy', 'Love cooking and code', 'Similar energy'],
      yesVotes: 4, noVotes: 0, label: 'Emma + Liam (4/5 yes - one more!)',
    },
    {
      a: FAKE_WALLETS.olivia, b: FAKE_WALLETS.noah,
      score: 0.85, reasons: ['Creative meets analytical', 'Shared love of travel', 'Both adventurous'],
      yesVotes: 4, noVotes: 0, label: 'Olivia + Noah (4/5 yes - one more!)',
    },
    {
      a: FAKE_WALLETS.ava, b: FAKE_WALLETS.ethan,
      score: 0.82, reasons: ['Design meets engineering', 'Both outdoor lovers', 'West coast vibes'],
      yesVotes: 4, noVotes: 1, label: 'Ava + Ethan (4/5 yes - one more!)',
    },
    {
      a: FAKE_WALLETS.mia, b: FAKE_WALLETS.lucas,
      score: 0.79, reasons: ['Music lovers', 'Both community-oriented', 'Complementary interests'],
      yesVotes: 2, noVotes: 1, label: 'Mia + Lucas (2/5 yes - early stage)',
    },
    {
      a: FAKE_WALLETS.sophia, b: FAKE_WALLETS.james,
      score: 0.84, reasons: ['Both intellectual', 'Governance + ZK overlap', 'Hackathon partners'],
      yesVotes: 3, noVotes: 0, label: 'Sophia + James (3/5 yes - needs 2 more)',
    },
  ];

  for (const pair of votingPairs) {
    const [userA, userB] = sortPair(pair.a, pair.b);
    const hash = pairHash(pair.a, pair.b);

    const { data: proposal, error } = await supabase
      .from('match_proposals')
      .insert({
        user_a_address: userA,
        user_b_address: userB,
        pair_hash: hash,
        ai_compatibility_score: pair.score,
        compatibility_reasons: pair.reasons,
        status: 'voting',
        yes_votes: pair.yesVotes,
        no_votes: pair.noVotes,
        total_votes_cast: pair.yesVotes + pair.noVotes,
        approval_threshold: 5,
        voting_started_at: votingStart,
        voting_expires_at: votingExpiry,
      })
      .select()
      .single();

    if (error) {
      console.error(`  Error (${pair.label}):`, error.message);
    } else {
      console.log(`  Created: ${pair.label} (id: ${proposal.id})`);

      // Create voter assignment for Rohan
      await supabase.from('voter_assignments').insert({
        match_proposal_id: proposal.id,
        voter_address: ROHAN,
        notified: true,
      });
    }
  }
  console.log('');
}

async function main() {
  console.log('=== ChainedTogether Demo Seed ===\n');

  await nukeAllData();
  await createFakeProfiles();
  await seedRohanRithvikMatch();
  await seedVotingFeed();

  console.log('=== Seed Complete ===');
  console.log('\nWhat to expect in the demo:');
  console.log('  MATCHES TAB:');
  console.log('    - Rohan + Rithvik: approved, both need to accept/decline');
  console.log('');
  console.log('  VOTE TAB (infinite feed):');
  console.log('    - Emma + Liam: 4/5 yes -> YOUR vote approves them!');
  console.log('    - Olivia + Noah: 4/5 yes -> YOUR vote approves them!');
  console.log('    - Ava + Ethan: 4/5 yes -> YOUR vote approves them!');
  console.log('    - Mia + Lucas: 2/5 yes (early)');
  console.log('    - Sophia + James: 3/5 yes (close)');
  console.log('');
  console.log('  Voting proposals expire in 30 min. Lifecycle jobs will');
  console.log('  finalize them after expiry based on final vote counts.');
}

main();
