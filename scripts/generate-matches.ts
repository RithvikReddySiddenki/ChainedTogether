/**
 * Admin script to generate match pairs and propose them on-chain
 * Run with: npx hardhat run scripts/generate-matches.ts --network localhost
 */

const { ethers } = require("hardhat");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

// Import AI client (note: in real setup, you'd import properly)
// For now, we'll inline the key functions

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

async function main() {
  console.log("=== ChainedTogether Match Generation ===\n");

  // Initialize Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials in .env");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get contract instances
  const matchRegistryAddress = process.env.NEXT_PUBLIC_MATCH_REGISTRY_ADDRESS;
  if (!matchRegistryAddress) {
    throw new Error("Missing contract address in .env");
  }

  const [admin] = await ethers.getSigners();
  console.log("Admin account:", admin.address);

  const MatchRegistry = await ethers.getContractAt(
    "MatchRegistry",
    matchRegistryAddress
  );

  // Fetch all profiles
  console.log("\nFetching profiles from Supabase...");
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*");

  if (profileError || !profiles || profiles.length < 2) {
    throw new Error("Need at least 2 profiles to generate matches");
  }

  console.log(`Found ${profiles.length} profiles`);

  // Generate match pairs using simple similarity
  console.log("\nGenerating match pairs...");
  const pairs = [];

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const profileA = profiles[i];
      const profileB = profiles[j];

      const score = cosineSimilarity(profileA.embedding, profileB.embedding);

      pairs.push({
        userA: profileA.wallet_address,
        userB: profileB.wallet_address,
        score,
        profileA,
        profileB,
      });
    }
  }

  // Sort by score and take top 3 for demo
  pairs.sort((a, b) => b.score - a.score);
  const topPairs = pairs.slice(0, 3);

  console.log(`Generated ${topPairs.length} match pairs`);

  // For each pair, create proposal and assign voters
  for (let i = 0; i < topPairs.length; i++) {
    const pair = topPairs[i];
    console.log(`\n--- Match ${i + 1} ---`);
    console.log(`User A: ${pair.profileA.name} (${pair.userA.slice(0, 6)}...)`);
    console.log(`User B: ${pair.profileB.name} (${pair.userB.slice(0, 6)}...)`);
    console.log(`Compatibility Score: ${(pair.score * 100).toFixed(1)}%`);

    // Create hashes
    const createdAt = Math.floor(Date.now() / 1000);
    const aiScoreHash = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "address", "address", "uint64"],
        [
          ethers.parseEther(pair.score.toString()),
          pair.userA,
          pair.userB,
          createdAt,
        ]
      )
    );
    const metadataHash = ethers.keccak256(
      ethers.solidityPacked(
        ["string", "address", "address"],
        ["v1", pair.userA, pair.userB]
      )
    );

    // Propose match on-chain
    console.log("Creating proposal on-chain...");
    const tx = await MatchRegistry.proposeMatch(
      pair.userB,
      aiScoreHash,
      metadataHash
    );
    const receipt = await tx.wait();

    // Get match ID from event
    const event = receipt.logs.find(
      (log: any) => log.fragment && log.fragment.name === "MatchProposed"
    );
    const matchId = event ? event.args[0] : i; // Fallback to index

    console.log(`Match ID: ${matchId}`);

    // Assign 10 random voters (excluding the matched users)
    const eligibleVoters = profiles.filter(
      (p: any) =>
        p.wallet_address !== pair.userA && p.wallet_address !== pair.userB
    );

    // If we don't have 10 eligible voters, use all available
    const votersToAssign = Math.min(10, eligibleVoters.length);
    const shuffled = eligibleVoters.sort(() => 0.5 - Math.random());
    const selectedVoters = shuffled.slice(0, votersToAssign);

    console.log(`Assigning ${selectedVoters.length} voters...`);

    // Insert voter assignments
    const voterAssignments = selectedVoters.map((voter: any) => ({
      match_id: Number(matchId),
      voter_address: voter.wallet_address,
      has_voted: false,
    }));

    const { error: insertError } = await supabase
      .from("match_voters")
      .insert(voterAssignments);

    if (insertError) {
      console.error("Error assigning voters:", insertError);
    } else {
      console.log(`✓ Assigned ${selectedVoters.length} voters`);
    }
  }

  console.log("\n=== Match Generation Complete ===");
  console.log(`Created ${topPairs.length} proposals`);
  console.log("Voters can now vote on these matches!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
