/**
 * Snapshot gasless DAO voting client
 *
 * Replaces the on-chain MatchRegistry.vote() calls with Snapshot's
 * off-chain EIP-712 signed messages (gasless for voters).
 *
 * Exports:
 *  - createMatchProposal()   — creates a Snapshot proposal for a match pair
 *  - castVote()               — gasless vote on a Snapshot proposal
 *  - getProposalResults()     — read vote tallies via Snapshot GraphQL
 *  - getProposalVotes()       — read individual votes for a proposal
 */

// ─── Environment ──────────────────────────────────────────
const SNAPSHOT_HUB =
  process.env.NEXT_PUBLIC_SNAPSHOT_HUB || 'https://hub.snapshot.org';
const SNAPSHOT_SPACE =
  process.env.NEXT_PUBLIC_SNAPSHOT_SPACE || '';
const SNAPSHOT_GRAPHQL = `${SNAPSHOT_HUB}/graphql`;

// ─── Types ────────────────────────────────────────────────

export interface SnapshotProposalParams {
  /** Ethers-compatible signer or web3 provider */
  web3: any;
  /** Proposer wallet address */
  account: string;
  /** Human-readable title */
  title: string;
  /** Markdown body describing the match */
  body: string;
  /** Vote duration in seconds (default: 600 = 10 min) */
  durationSeconds?: number;
  /** Current block number for snapshot */
  blockNumber?: number;
}

export interface SnapshotVoteParams {
  /** Ethers-compatible signer or web3 provider */
  web3: any;
  /** Voter wallet address */
  account: string;
  /** Snapshot proposal ID */
  proposalId: string;
  /** 1 = Approve, 2 = Reject (Snapshot uses 1-indexed choice numbers) */
  choice: 1 | 2;
}

export interface ProposalResult {
  id: string;
  title: string;
  state: 'active' | 'closed' | 'pending';
  scores: number[];       // [approveScore, rejectScore]
  scores_total: number;
  votes: number;           // total number of votes
  choices: string[];
}

export interface VoteRecord {
  voter: string;
  choice: number;
  created: number;
}

// ─── Lazy-loaded Snapshot client ──────────────────────────

let _client: any = null;

async function getClient() {
  if (_client) return _client;
  try {
    const snapshot = await import('@snapshot-labs/snapshot.js');
    const Client = (snapshot as any).default?.Client712 || (snapshot as any).Client712;
    _client = new Client(SNAPSHOT_HUB);
    return _client;
  } catch {
    console.warn('[Snapshot] @snapshot-labs/snapshot.js not available — votes will be recorded in Supabase only');
    return null;
  }
}

// ─── Create Proposal ──────────────────────────────────────

export async function createMatchProposal(
  params: SnapshotProposalParams
): Promise<{ id: string } | null> {
  const {
    web3,
    account,
    title,
    body,
    durationSeconds = 600,
    blockNumber,
  } = params;

  if (!SNAPSHOT_SPACE) {
    console.warn('[Snapshot] No SNAPSHOT_SPACE configured — skipping proposal creation');
    return null;
  }

  const client = await getClient();
  if (!client) return null;

  const now = Math.floor(Date.now() / 1000);

  try {
    const receipt = await client.proposal(web3, account, {
      space: SNAPSHOT_SPACE,
      type: 'single-choice',
      title,
      body,
      choices: ['Approve Match', 'Reject Match'],
      start: now,
      end: now + durationSeconds,
      snapshot: blockNumber || now,
      network: '1', // Ethereum mainnet for signature validation
      plugins: JSON.stringify({}),
      app: 'chained-together',
    });

    console.log('[Snapshot] Proposal created:', receipt?.id);
    return { id: receipt?.id || '' };
  } catch (err) {
    console.error('[Snapshot] Failed to create proposal:', err);
    return null;
  }
}

// ─── Cast Vote (gasless) ─────────────────────────────────

export async function castVote(
  params: SnapshotVoteParams
): Promise<{ id: string } | null> {
  const { web3, account, proposalId, choice } = params;

  if (!SNAPSHOT_SPACE) {
    console.warn('[Snapshot] No SNAPSHOT_SPACE configured — skipping vote');
    return null;
  }

  const client = await getClient();
  if (!client) return null;

  try {
    const receipt = await client.vote(web3, account, {
      space: SNAPSHOT_SPACE,
      proposal: proposalId,
      type: 'single-choice',
      choice,
      app: 'chained-together',
    });

    console.log('[Snapshot] Vote cast:', receipt?.id);
    return { id: receipt?.id || '' };
  } catch (err) {
    console.error('[Snapshot] Failed to cast vote:', err);
    return null;
  }
}

// ─── Read Proposal Results (GraphQL) ──────────────────────

export async function getProposalResults(
  proposalId: string
): Promise<ProposalResult | null> {
  const query = `
    query Proposal($id: String!) {
      proposal(id: $id) {
        id
        title
        state
        scores
        scores_total
        votes
        choices
      }
    }
  `;

  try {
    const res = await fetch(SNAPSHOT_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { id: proposalId },
      }),
    });

    const data = await res.json();
    const proposal = data?.data?.proposal;

    if (!proposal) return null;

    return {
      id: proposal.id,
      title: proposal.title,
      state: proposal.state,
      scores: proposal.scores || [0, 0],
      scores_total: proposal.scores_total || 0,
      votes: proposal.votes || 0,
      choices: proposal.choices || ['Approve Match', 'Reject Match'],
    };
  } catch (err) {
    console.error('[Snapshot] Failed to fetch proposal results:', err);
    return null;
  }
}

// ─── Read Individual Votes ────────────────────────────────

export async function getProposalVotes(
  proposalId: string,
  first = 100
): Promise<VoteRecord[]> {
  const query = `
    query Votes($proposalId: String!, $first: Int!) {
      votes(
        where: { proposal: $proposalId }
        first: $first
        orderBy: "created"
        orderDirection: desc
      ) {
        voter
        choice
        created
      }
    }
  `;

  try {
    const res = await fetch(SNAPSHOT_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { proposalId, first },
      }),
    });

    const data = await res.json();
    return (data?.data?.votes || []).map((v: any) => ({
      voter: v.voter,
      choice: v.choice,
      created: v.created,
    }));
  } catch (err) {
    console.error('[Snapshot] Failed to fetch votes:', err);
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Build a Snapshot proposal title from match pair data.
 */
export function buildProposalTitle(
  userAName: string,
  userBName: string,
  proposalDbId: number
): string {
  return `Match #${proposalDbId}: ${userAName} + ${userBName}`;
}

/**
 * Build a Snapshot proposal body from match pair data.
 */
export function buildProposalBody(params: {
  userAName: string;
  userABio: string;
  userBName: string;
  userBBio: string;
  score: number;
  reasons: string[];
}): string {
  const { userAName, userABio, userBName, userBBio, score, reasons } = params;
  return `## Match Proposal

**${userAName}**: ${userABio}

**${userBName}**: ${userBBio}

### AI Compatibility Score: ${Math.round(score * 100)}%

${reasons.map((r) => `- ${r}`).join('\n')}

---
*Vote to approve or reject this match.*`;
}
