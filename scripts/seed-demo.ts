#!/usr/bin/env node

/**
 * Seed script: populates Supabase with demo profiles, match queue, proposals, and voter assignments.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts [YOUR_WALLET_ADDRESS]
 *
 * If no wallet address is provided, the first Hardhat account is used.
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';
import { keccak256, encodePacked } from 'viem';

// ─── Supabase ────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Demo Data ───────────────────────────────────────────

// First Hardhat default account
const HARDHAT_ACCOUNT_0 = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

interface DemoProfile {
  wallet_address: string;
  name: string;
  bio: string;
  age: number;
  location: string;
  image_url: string;
  answers_json: {
    interests: string[];
    values: string[];
    communicationStyle: string;
    dealbreakers: string[];
    lifestyle: string[];
    goals: string;
  };
}

const DEMO_PROFILES: DemoProfile[] = [
  {
    wallet_address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    name: 'Maya Chen',
    bio: "I'm a software engineer who unwinds by cooking elaborate meals from scratch — my spaghetti carbonara is legendary. When I'm not coding or in the kitchen, you'll find me buried in a sci-fi novel or planning my next backpacking trip.",
    age: 24,
    location: 'San Francisco, CA',
    image_url: 'https://i.pravatar.cc/300?img=5',
    answers_json: {
      interests: ['reading', 'technology', 'cooking', 'travel'],
      values: ['honesty', 'ambition', 'kindness'],
      communicationStyle: 'direct',
      dealbreakers: ['dishonesty'],
      lifestyle: ['active', 'social'],
      goals: 'long-term commitment',
    },
  },
  {
    wallet_address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    name: 'Liam Park',
    bio: "I hit the trails before sunrise most mornings and play guitar in a local indie band on weekends. I work in tech but honestly feel most alive outdoors — bonus points if you want to join me on a sunrise hike.",
    age: 27,
    location: 'Austin, TX',
    image_url: 'https://i.pravatar.cc/300?img=11',
    answers_json: {
      interests: ['fitness', 'music', 'outdoors', 'technology'],
      values: ['loyalty', 'family', 'ambition'],
      communicationStyle: 'direct',
      dealbreakers: ['smoking'],
      lifestyle: ['active', 'balanced'],
      goals: 'long-term commitment',
    },
  },
  {
    wallet_address: '0x90f79bf6eb2c4f870365e785982e1f101e93b906',
    name: 'Ava Mitchell',
    bio: "I paint murals around Brooklyn by day and dig through vinyl crates by night. My perfect Saturday involves a farmers market haul, experimenting with a new recipe, and an impromptu road trip if the weather's right.",
    age: 22,
    location: 'Brooklyn, NY',
    image_url: 'https://i.pravatar.cc/300?img=9',
    answers_json: {
      interests: ['art', 'music', 'travel', 'cooking'],
      values: ['kindness', 'honesty'],
      communicationStyle: 'diplomatic',
      dealbreakers: ['dishonesty'],
      lifestyle: ['social', 'introverted'],
      goals: 'seeking meaningful connection',
    },
  },
  {
    wallet_address: '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65',
    name: 'Noah Williams',
    bio: "I climb mountains, ski backcountry lines, and read philosophy on rest days. Working remotely lets me live ten minutes from the trailhead, which is basically my dream setup. Looking for someone who'd rather wake up in a tent than a hotel.",
    age: 29,
    location: 'Denver, CO',
    image_url: 'https://i.pravatar.cc/300?img=12',
    answers_json: {
      interests: ['outdoors', 'fitness', 'reading', 'travel'],
      values: ['honesty', 'loyalty', 'family'],
      communicationStyle: 'balanced',
      dealbreakers: ['smoking', 'dishonesty'],
      lifestyle: ['active', 'balanced'],
      goals: 'long-term commitment',
    },
  },
  {
    wallet_address: '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc',
    name: 'Sophia Reyes',
    bio: "I teach Pilates in the mornings, throw pottery in my garage studio, and cook my abuela's tamale recipe every Sunday. I'm happiest when I'm creating something with my hands — even better if it's with someone I care about.",
    age: 25,
    location: 'Los Angeles, CA',
    image_url: 'https://i.pravatar.cc/300?img=25',
    answers_json: {
      interests: ['art', 'cooking', 'music', 'fitness'],
      values: ['kindness', 'ambition', 'honesty'],
      communicationStyle: 'diplomatic',
      dealbreakers: ['dishonesty'],
      lifestyle: ['social', 'active'],
      goals: 'seeking meaningful connection',
    },
  },
  {
    wallet_address: '0x976ea74026e726554db657fa54763abd0c3a0aa9',
    name: 'Ethan Brooks',
    bio: "I write backend code during the week and disappear into the Cascades on weekends. Most evenings you'll find me reading about exoplanets or tinkering with a side project. I'm pretty introverted but open up fast with the right person.",
    age: 26,
    location: 'Seattle, WA',
    image_url: 'https://i.pravatar.cc/300?img=14',
    answers_json: {
      interests: ['technology', 'reading', 'outdoors'],
      values: ['honesty', 'ambition'],
      communicationStyle: 'direct',
      dealbreakers: ['smoking'],
      lifestyle: ['introverted', 'balanced'],
      goals: 'taking things slow',
    },
  },
  {
    wallet_address: '0x14dc79964da2c08dda394f80782ef11c7d9283cd',
    name: 'Isabella Torres',
    bio: "I've traveled to 30 countries and collected a recipe from every single one — my passport and my spice rack are equally full. I also play ukulele terribly but with great enthusiasm. Always down for a spontaneous adventure.",
    age: 23,
    location: 'Miami, FL',
    image_url: 'https://i.pravatar.cc/300?img=32',
    answers_json: {
      interests: ['travel', 'cooking', 'music', 'art'],
      values: ['family', 'kindness', 'loyalty'],
      communicationStyle: 'diplomatic',
      dealbreakers: ['dishonesty'],
      lifestyle: ['social', 'active'],
      goals: 'long-term commitment',
    },
  },
  {
    wallet_address: '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f',
    name: 'James Nakamura',
    bio: "I play jazz piano at a little bar downtown and build custom mechanical keyboards when I need to zone out. I'd rather have one great conversation over homemade ramen than be at a party with a hundred people.",
    age: 28,
    location: 'Portland, OR',
    image_url: 'https://i.pravatar.cc/300?img=15',
    answers_json: {
      interests: ['music', 'art', 'cooking', 'technology'],
      values: ['kindness', 'honesty'],
      communicationStyle: 'balanced',
      dealbreakers: ['dishonesty'],
      lifestyle: ['introverted', 'balanced'],
      goals: 'seeking meaningful connection',
    },
  },
  {
    wallet_address: '0xa0ee7a142d267c1f36714e4a8f75612f20a79720',
    name: 'Olivia Andersen',
    bio: "I'm a pre-med student training for my third marathon and I journal every single morning before the sun comes up. On weekends I'm either at a bookstore or on a camping trip — ideally both if I pack the right books.",
    age: 21,
    location: 'Chicago, IL',
    image_url: 'https://i.pravatar.cc/300?img=44',
    answers_json: {
      interests: ['reading', 'fitness', 'outdoors', 'travel'],
      values: ['loyalty', 'honesty', 'ambition'],
      communicationStyle: 'direct',
      dealbreakers: ['smoking'],
      lifestyle: ['active', 'social'],
      goals: 'long-term commitment',
    },
  },
  {
    wallet_address: '0xbcd4042de499d14e55001ccbb24a551f3b954096',
    name: 'Daniel Patel',
    bio: "I crunch data by day and crush CrossFit WODs by evening — then unwind with whatever non-fiction book I'm obsessed with that week. I'm driven and health-focused, and I want someone who gets excited about building a life with purpose.",
    age: 30,
    location: 'Boston, MA',
    image_url: 'https://i.pravatar.cc/300?img=53',
    answers_json: {
      interests: ['technology', 'fitness', 'reading'],
      values: ['ambition', 'honesty', 'loyalty'],
      communicationStyle: 'direct',
      dealbreakers: ['smoking', 'dishonesty'],
      lifestyle: ['active', 'balanced'],
      goals: 'long-term commitment',
    },
  },
  {
    wallet_address: '0x71be63f3384f5fb98995898a86b02fb2426c5788',
    name: 'Chloe Kim',
    bio: "I write songs during the week and teach cooking classes on Saturdays — food and music are basically my love languages. My happy place is a potluck dinner with close friends or painting outdoors when the light is just right.",
    age: 24,
    location: 'Nashville, TN',
    image_url: 'https://i.pravatar.cc/300?img=47',
    answers_json: {
      interests: ['music', 'cooking', 'art', 'outdoors'],
      values: ['kindness', 'family'],
      communicationStyle: 'diplomatic',
      dealbreakers: ['dishonesty'],
      lifestyle: ['social', 'balanced'],
      goals: 'seeking meaningful connection',
    },
  },
  {
    wallet_address: '0xfabb0ac9d68b0b445fb7357272ff202c5651694a',
    name: 'Ryan Cooper',
    bio: "I guide rock climbing trips for a living and build FPV drones as my nerdy side hobby. Most of my free time involves a tent, a national park, and zero cell service. I'm loyal and adventurous — looking for someone who keeps up.",
    age: 26,
    location: 'Phoenix, AZ',
    image_url: 'https://i.pravatar.cc/300?img=57',
    answers_json: {
      interests: ['fitness', 'outdoors', 'travel', 'technology'],
      values: ['loyalty', 'ambition'],
      communicationStyle: 'direct',
      dealbreakers: ['smoking'],
      lifestyle: ['active', 'social'],
      goals: 'taking things slow',
    },
  },
  {
    wallet_address: '0x1cbd3b2770909d4e10f157cabc84c7264073c9ec',
    name: 'Emma Larsen',
    bio: "I illustrate children's books, bake sourdough that actually turns out well, and strum folk songs on my beat-up guitar. My ideal evening is a cozy coffee shop, a good novel, and nowhere I need to be. Quiet but full of warmth.",
    age: 22,
    location: 'Minneapolis, MN',
    image_url: 'https://i.pravatar.cc/300?img=38',
    answers_json: {
      interests: ['reading', 'art', 'cooking', 'music'],
      values: ['honesty', 'kindness', 'family'],
      communicationStyle: 'balanced',
      dealbreakers: ['dishonesty'],
      lifestyle: ['introverted', 'balanced'],
      goals: 'seeking meaningful connection',
    },
  },
  {
    wallet_address: '0xdf3e18d64bc6a983f673ab319ccae4f1a57c7097',
    name: 'Marcus Johnson',
    bio: "I produce beats in my home studio and hit the gym before most people's alarms go off. On weekends I hike with my golden retriever, catch live shows, and run pickup basketball games. I bring the same energy to everything I do.",
    age: 27,
    location: 'Atlanta, GA',
    image_url: 'https://i.pravatar.cc/300?img=60',
    answers_json: {
      interests: ['music', 'fitness', 'technology', 'outdoors'],
      values: ['loyalty', 'honesty', 'ambition'],
      communicationStyle: 'direct',
      dealbreakers: ['smoking'],
      lifestyle: ['active', 'social'],
      goals: 'long-term commitment',
    },
  },
];

// ─── Embedding Generation ────────────────────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateEmbedding(profile: DemoProfile['answers_json']): number[] {
  const embedding = new Array(128).fill(0);

  profile.interests.forEach((interest) => {
    const hash = simpleHash(interest);
    embedding[hash % 128] += 0.5;
  });

  profile.values.forEach((value) => {
    const hash = simpleHash(value);
    embedding[(hash + 20) % 128] += 0.4;
  });

  profile.lifestyle.forEach((item) => {
    const hash = simpleHash(item);
    embedding[(hash + 40) % 128] += 0.3;
  });

  const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
  return embedding.map((val: number) => val / (magnitude || 1));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

function generatePairHash(userA: string, userB: string): string {
  const addresses = [userA.toLowerCase(), userB.toLowerCase()].sort();
  return keccak256(encodePacked(['address', 'address'], addresses as [`0x${string}`, `0x${string}`]));
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const myWallet = (process.argv[2] || HARDHAT_ACCOUNT_0).toLowerCase();

  console.log('=== ChainedTogether Demo Seed ===\n');
  console.log(`Your wallet: ${myWallet}`);
  console.log(`Supabase URL: ${supabaseUrl.slice(0, 30)}...`);

  // 1. Upsert profiles
  console.log('\n--- Step 1: Seeding profiles ---');

  // Add the user's own wallet as a profile if not in the demo list
  const allProfiles = [...DEMO_PROFILES];
  const userAlreadyExists = allProfiles.some(
    (p) => p.wallet_address.toLowerCase() === myWallet
  );

  if (!userAlreadyExists) {
    allProfiles.push({
      wallet_address: myWallet,
      name: 'You (Demo)',
      bio: "I'm deep into blockchain and love building things that push the boundaries of what's possible. When I'm not coding, I'm chasing live music, exploring new cities, or trying to beat my running PR.",
      age: 25,
      location: 'Your City',
      image_url: 'https://i.pravatar.cc/300?img=68',
      answers_json: {
        interests: ['technology', 'travel', 'music', 'fitness'],
        values: ['honesty', 'loyalty', 'ambition'],
        communicationStyle: 'balanced',
        dealbreakers: ['dishonesty'],
        lifestyle: ['active', 'social'],
        goals: 'seeking meaningful connection',
      },
    });
  }

  const profileRows = allProfiles.map((p) => ({
    wallet_address: p.wallet_address.toLowerCase(),
    name: p.name,
    bio: p.bio,
    age: p.age,
    location: p.location,
    image_url: p.image_url,
    answers_json: p.answers_json,
    embedding: generateEmbedding(p.answers_json),
  }));

  // Try upsert with bio field first
  let { error: profileError } = await supabase
    .from('profiles')
    .upsert(profileRows, { onConflict: 'wallet_address' });

  // If bio column doesn't exist yet, retry without it
  if (profileError && profileError.message?.includes('bio')) {
    console.log('  Note: bio column not found, upserting without bio (run migration 003 to add it)');
    const rowsNoBio = profileRows.map(({ bio, ...rest }) => rest);
    const retry = await supabase
      .from('profiles')
      .upsert(rowsNoBio, { onConflict: 'wallet_address' });
    profileError = retry.error;
  }

  if (profileError) {
    console.error('Profile upsert error:', profileError);
    process.exit(1);
  }
  console.log(`Upserted ${profileRows.length} profiles`);

  // 2. Generate match pairs and queue them
  console.log('\n--- Step 2: Generating match pairs ---');

  // Score all pairs
  type ScoredPair = {
    userA: string;
    userB: string;
    score: number;
    compatibility: string[];
  };

  const scoredPairs: ScoredPair[] = [];

  for (let i = 0; i < profileRows.length; i++) {
    for (let j = i + 1; j < profileRows.length; j++) {
      const a = profileRows[i];
      const b = profileRows[j];
      const score = cosineSimilarity(a.embedding, b.embedding);

      const compatibility: string[] = [];
      const commonInterests = allProfiles[i].answers_json.interests.filter((x) =>
        allProfiles[j].answers_json.interests.includes(x)
      );
      if (commonInterests.length > 0)
        compatibility.push(`Shared interests: ${commonInterests.join(', ')}`);

      const commonValues = allProfiles[i].answers_json.values.filter((x) =>
        allProfiles[j].answers_json.values.includes(x)
      );
      if (commonValues.length > 0)
        compatibility.push(`Common values: ${commonValues.join(', ')}`);

      if (
        allProfiles[i].answers_json.communicationStyle ===
        allProfiles[j].answers_json.communicationStyle
      )
        compatibility.push(
          `Both prefer ${allProfiles[i].answers_json.communicationStyle} communication`
        );

      if (allProfiles[i].answers_json.goals === allProfiles[j].answers_json.goals)
        compatibility.push(`Aligned on: ${allProfiles[i].answers_json.goals}`);

      if (compatibility.length === 0)
        compatibility.push('Compatible personalities based on AI analysis');

      scoredPairs.push({
        userA: a.wallet_address,
        userB: b.wallet_address,
        score: Math.round(score * 100) / 100,
        compatibility,
      });
    }
  }

  scoredPairs.sort((a, b) => b.score - a.score);

  // Take top 30 for the queue
  const queuePairs = scoredPairs.slice(0, 30);

  const queueEntries = queuePairs.map((p) => {
    const addresses = [p.userA, p.userB].sort();
    return {
      user_a_address: addresses[0],
      user_b_address: addresses[1],
      pair_hash: generatePairHash(addresses[0], addresses[1]),
      ai_compatibility_score: Math.min(p.score, 0.99), // ensure <= 1.00 with 2 decimal places
      compatibility_reasons: p.compatibility,
    };
  });

  // Clean existing queue first
  await supabase.from('match_generation_queue').delete().neq('id', 0);

  const { error: queueError } = await supabase
    .from('match_generation_queue')
    .insert(queueEntries);

  if (queueError) {
    console.error('Queue insert error:', queueError);
    // Continue anyway - proposals might work
  } else {
    console.log(`Queued ${queueEntries.length} match pairs`);
  }

  // 3. Create proposals directly and assign voters
  console.log('\n--- Step 3: Creating proposals with voter assignments ---');

  // Clean existing proposals (reset for demo)
  await supabase.from('match_votes').delete().neq('id', 0);
  await supabase.from('voter_assignments').delete().neq('id', 0);
  await supabase.from('conversations').delete().neq('id', 0);
  await supabase.from('match_proposals').delete().neq('id', 0);

  // Pick top 12 pairs for proposals
  const proposalPairs = scoredPairs.slice(0, 12);

  let proposalsCreated = 0;
  let assignmentsWithUser = 0;

  for (const pair of proposalPairs) {
    const addresses = [pair.userA, pair.userB].sort();

    const { data: proposal, error: propError } = await supabase
      .from('match_proposals')
      .insert({
        user_a_address: addresses[0],
        user_b_address: addresses[1],
        pair_hash: generatePairHash(addresses[0], addresses[1]),
        ai_compatibility_score: Math.min(pair.score, 0.99),
        compatibility_reasons: pair.compatibility,
        status: 'voting',
        voting_started_at: new Date().toISOString(),
        voting_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min for demo
      })
      .select()
      .single();

    if (propError) {
      console.error(`  Proposal error for ${addresses[0].slice(0, 8)}..↔${addresses[1].slice(0, 8)}..:`, propError.message);
      continue;
    }

    proposalsCreated++;

    // Assign voters: always include myWallet (unless they are part of the pair)
    const isPairMember =
      addresses[0] === myWallet || addresses[1] === myWallet;

    // Pick 9 random voters from profiles (excluding pair members)
    const eligible = profileRows.filter(
      (p) =>
        p.wallet_address !== addresses[0] &&
        p.wallet_address !== addresses[1] &&
        p.wallet_address !== myWallet
    );

    const shuffled = [...eligible].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, isPairMember ? 10 : 9);

    const voters = picked.map((p) => ({
      match_proposal_id: proposal.id,
      voter_address: p.wallet_address,
    }));

    // Add user's wallet if they're not part of the pair
    if (!isPairMember) {
      voters.push({
        match_proposal_id: proposal.id,
        voter_address: myWallet,
      });
      assignmentsWithUser++;
    }

    const { error: voterError } = await supabase
      .from('voter_assignments')
      .insert(voters);

    if (voterError) {
      console.error(`  Voter assignment error for proposal ${proposal.id}:`, voterError.message);
    } else {
      console.log(
        `  Proposal #${proposal.id}: ${pair.userA.slice(0, 8)}.. <-> ${pair.userB.slice(0, 8)}.. | score=${pair.score.toFixed(2)} | ${voters.length} voters${!isPairMember ? ' (incl. you)' : ' (you are in pair)'}`
      );
    }
  }

  console.log(`\nCreated ${proposalsCreated} proposals`);
  console.log(`You are assigned as voter on ${assignmentsWithUser} proposals`);

  // 4. Summary
  console.log('\n=== Seed Complete ===');
  console.log(`Profiles:       ${profileRows.length}`);
  console.log(`Queue depth:    ${queueEntries.length}`);
  console.log(`Proposals:      ${proposalsCreated}`);
  console.log(`Your votes:     ${assignmentsWithUser} proposals waiting`);
  console.log('\nGo to http://localhost:3000/vote and connect your wallet to start voting!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
