/**
 * 0G-powered matchmaker
 *
 * Exports two functions consumed by matchLifecycleJobs.ts and run-jobs.ts:
 *
 *  1. scorePair({ userA, userB })
 *       → { score: 0-100, reasons: string[] }
 *
 *  2. rankCandidatesForUser({ user, candidates, k })
 *       → [{ wallet, score, reasons }]  (top-k)
 *
 * Both call inferJSON from ../0gComputeClient. On inference failure they
 * fall back to a deterministic string-similarity heuristic so the pipeline
 * never stalls.
 */

import { inferJSON } from '../0gComputeClient';

// ─── Types ────────────────────────────────────────────────

export interface ProfileBio {
  wallet_address: string;
  name: string;
  bio: string;           // The ONLY text the AI sees for matching
}

export interface ScorePairResult {
  score: number;         // 0-100
  reasons: string[];
}

export interface RankedCandidate {
  wallet: string;
  score: number;
  reasons: string[];
}

// ─── Prompts ──────────────────────────────────────────────

const SCORE_PAIR_SYSTEM = `You are a compatibility scoring engine for a social matching DAO.
Given two user bios, evaluate how well they would match as a pair.
Return ONLY valid JSON with this exact schema:
{
  "score": <integer 0-100>,
  "reasons": ["<reason1>", "<reason2>", ...]
}
Score guide:
 0-20  = very incompatible
 21-40 = weak match
 41-60 = moderate match
 61-80 = strong match
 81-100 = exceptional match
Provide 2-4 short, specific reasons based on their bios.`;

const RANK_CANDIDATES_SYSTEM = `You are a compatibility ranking engine for a social matching DAO.
Given one target user bio and a list of candidate bios, rank the candidates
by compatibility with the target user.
Return ONLY valid JSON with this exact schema:
{
  "rankings": [
    { "wallet": "<wallet_address>", "score": <integer 0-100>, "reasons": ["<r1>", "<r2>"] },
    ...
  ]
}
Order by score descending. Provide 1-3 short reasons per candidate.
Only include the top candidates as requested.`;

// ─── scorePair ────────────────────────────────────────────

export async function scorePair(params: {
  userA: ProfileBio;
  userB: ProfileBio;
}): Promise<ScorePairResult> {
  const { userA, userB } = params;

  const userPrompt = `User A (${userA.name}): ${userA.bio}

User B (${userB.name}): ${userB.bio}

Score this pair.`;

  try {
    const result = await inferJSON<{ score: number; reasons: string[] }>({
      systemPrompt: SCORE_PAIR_SYSTEM,
      userPrompt,
      model: 'qwen-2.5-7b-instruct',
      temperature: 0.2,
      maxTokens: 600,
    });

    // Clamp + validate
    const score = Math.max(0, Math.min(100, Math.round(result.score ?? 50)));
    const reasons = Array.isArray(result.reasons) ? result.reasons.slice(0, 5) : [];

    return { score, reasons: reasons.length > 0 ? reasons : ['AI-scored compatibility'] };
  } catch (err) {
    console.warn('[ogMatchmaker] scorePair inference failed, using fallback:', err);
    return fallbackScorePair(userA, userB);
  }
}

// ─── rankCandidatesForUser ────────────────────────────────

export async function rankCandidatesForUser(params: {
  user: ProfileBio;
  candidates: ProfileBio[];
  k?: number;
}): Promise<RankedCandidate[]> {
  const { user, candidates, k = 10 } = params;

  if (candidates.length === 0) return [];

  // Truncate candidate list for the prompt to stay within token limits
  const maxCandidates = Math.min(candidates.length, 30);
  const subset = candidates.slice(0, maxCandidates);

  const candidateList = subset
    .map((c, i) => `${i + 1}. wallet=${c.wallet_address} | ${c.name}: ${c.bio}`)
    .join('\n');

  const userPrompt = `Target user (${user.name}): ${user.bio}

Candidates:
${candidateList}

Rank the top ${Math.min(k, subset.length)} candidates for the target user.`;

  try {
    const result = await inferJSON<{
      rankings: Array<{ wallet: string; score: number; reasons: string[] }>;
    }>({
      systemPrompt: RANK_CANDIDATES_SYSTEM,
      userPrompt,
      model: 'qwen-2.5-7b-instruct',
      temperature: 0.2,
      maxTokens: 900,
    });

    if (!Array.isArray(result.rankings)) {
      throw new Error('rankings is not an array');
    }

    return result.rankings
      .map((r) => ({
        wallet: r.wallet,
        score: Math.max(0, Math.min(100, Math.round(r.score ?? 50))),
        reasons: Array.isArray(r.reasons) ? r.reasons.slice(0, 4) : ['AI-ranked'],
      }))
      .slice(0, k);
  } catch (err) {
    console.warn('[ogMatchmaker] rankCandidatesForUser inference failed, using fallback:', err);
    return fallbackRankCandidates(user, candidates, k);
  }
}

// ─── Convenience: generateMatchPairs (drop-in for old API) ─

/**
 * Generate scored pairs from a pool of profiles.
 * This is the drop-in replacement for the old zeroGClient.generateMatchPairs().
 */
export async function generateMatchPairs(params: {
  allProfiles: Array<{
    wallet_address: string;
    name: string;
    bio?: string;
    answers_json?: any;
    [key: string]: any;
  }>;
  pairsToGenerate?: number;
}): Promise<
  Array<{
    userA: string;
    userB: string;
    score: number;
    compatibility: string[];
  }>
> {
  const { allProfiles, pairsToGenerate = 10 } = params;

  // Build ProfileBio for each profile, using bio text only
  const bios: ProfileBio[] = allProfiles.map((p) => ({
    wallet_address: p.wallet_address,
    name: p.name || 'Anonymous',
    bio:
      p.bio ||
      p.answers_json?.bio ||
      p.answers_json?.goals ||
      `${p.name || 'User'} is looking for meaningful connections.`,
  }));

  // Strategy: for each user, rank candidates and collect top pairs
  const pairMap = new Map<string, { userA: string; userB: string; score: number; compatibility: string[] }>();

  for (const user of bios) {
    if (pairMap.size >= pairsToGenerate) break;

    const candidates = bios.filter(
      (c) => c.wallet_address.toLowerCase() !== user.wallet_address.toLowerCase()
    );

    const ranked = await rankCandidatesForUser({
      user,
      candidates,
      k: Math.min(5, candidates.length),
    });

    for (const match of ranked) {
      if (pairMap.size >= pairsToGenerate) break;

      const key = [user.wallet_address, match.wallet]
        .map((a) => a.toLowerCase())
        .sort()
        .join('-');

      if (!pairMap.has(key)) {
        pairMap.set(key, {
          userA: user.wallet_address,
          userB: match.wallet,
          score: match.score / 100, // Normalize to 0-1 for compatibility with old code
          compatibility: match.reasons,
        });
      }
    }
  }

  return Array.from(pairMap.values()).slice(0, pairsToGenerate);
}

// ─── Deterministic fallback scoring ───────────────────────

/** Simple word-overlap heuristic. Never calls the network. */
function fallbackScorePair(a: ProfileBio, b: ProfileBio): ScorePairResult {
  const wordsA = new Set(tokenize(a.bio));
  const wordsB = new Set(tokenize(b.bio));

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = union > 0 ? overlap / union : 0;
  const score = Math.round(jaccard * 100);

  const reasons: string[] = [];
  if (overlap > 0) {
    const shared = [...wordsA].filter((w) => wordsB.has(w)).slice(0, 3);
    reasons.push(`Shared themes: ${shared.join(', ')}`);
  }
  reasons.push('Fallback heuristic (AI unavailable)');

  return { score, reasons };
}

function fallbackRankCandidates(
  user: ProfileBio,
  candidates: ProfileBio[],
  k: number
): RankedCandidate[] {
  const scored = candidates.map((c) => {
    const { score, reasons } = fallbackScorePair(user, c);
    return { wallet: c.wallet_address, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/** Tokenize bio text into meaningful lowercase words. */
function tokenize(text: string): string[] {
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
    'being', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
    'they', 'them', 'their', 'this', 'that', 'who', 'which', 'what',
    'looking', 'love', 'like', 'just', 'really', 'very', 'so', 'too',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}
