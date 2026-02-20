# ChainedTogether - System Architecture

## Overview

This document defines the complete data structure and lifecycle management for match proposals in a decentralized matchmaking DAO.

---

## 🎯 Core Requirements

1. **Stateful match lifecycle**: proposed → voting → approved/rejected/expired/blocked
2. **No duplicate pairs**: Each user pair can only have ONE active proposal
3. **Continuous availability**: Users always have matches to vote on
4. **Efficient lookups**: User-centric, voter-centric, status-based queries
5. **Privacy gating**: Limited profile visibility until approval
6. **Auditability**: All votes recorded with timestamps
7. **Scalability**: No global bottlenecks

---

## 🗂️ Data Model (PostgreSQL/Supabase)

### 1. Match Proposals (Core State Machine)

```sql
CREATE TABLE match_proposals (
  id BIGSERIAL PRIMARY KEY,

  -- === PAIR IDENTIFICATION ===
  user_a_address TEXT NOT NULL,
  user_b_address TEXT NOT NULL,
  pair_hash TEXT UNIQUE NOT NULL, -- keccak256(sorted addresses) - prevents duplicates

  -- === AI MATCHING DATA ===
  ai_compatibility_score DECIMAL(3,2) NOT NULL CHECK (ai_compatibility_score >= 0 AND ai_compatibility_score <= 1),
  compatibility_reasons JSONB NOT NULL DEFAULT '[]', -- Array of reason strings

  -- === LIFECYCLE STATE ===
  status TEXT NOT NULL CHECK (status IN ('proposed', 'voting', 'approved', 'rejected', 'expired', 'blocked')),

  -- === BLOCKCHAIN REFERENCE ===
  on_chain_proposal_id INTEGER UNIQUE, -- NULL until proposed on-chain
  on_chain_tx_hash TEXT,

  -- === VOTING METADATA ===
  yes_votes INTEGER NOT NULL DEFAULT 0,
  no_votes INTEGER NOT NULL DEFAULT 0,
  total_votes_cast INTEGER NOT NULL DEFAULT 0,
  quorum_required INTEGER NOT NULL DEFAULT 10,
  approval_threshold INTEGER NOT NULL DEFAULT 5,
  rejection_threshold INTEGER NOT NULL DEFAULT 5,

  -- === TIMESTAMPS ===
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voting_started_at TIMESTAMPTZ,
  voting_expires_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,

  -- === CONSTRAINTS ===
  CONSTRAINT valid_pair CHECK (user_a_address < user_b_address), -- Enforce alphabetical ordering
  CONSTRAINT valid_voting_window CHECK (voting_expires_at > voting_started_at OR voting_expires_at IS NULL),
  CONSTRAINT valid_vote_counts CHECK (yes_votes >= 0 AND no_votes >= 0 AND total_votes_cast = yes_votes + no_votes)
);

-- Pair uniqueness index (critical!)
CREATE UNIQUE INDEX idx_match_proposals_pair_hash ON match_proposals(pair_hash);

-- User-centric lookups
CREATE INDEX idx_match_proposals_user_a ON match_proposals(user_a_address, status, created_at DESC);
CREATE INDEX idx_match_proposals_user_b ON match_proposals(user_b_address, status, created_at DESC);

-- Status-based queries
CREATE INDEX idx_match_proposals_status ON match_proposals(status, created_at DESC);

-- Expiration monitoring
CREATE INDEX idx_match_proposals_expiring ON match_proposals(voting_expires_at, status)
  WHERE status = 'voting' AND voting_expires_at IS NOT NULL;

-- On-chain reference lookup
CREATE INDEX idx_match_proposals_on_chain ON match_proposals(on_chain_proposal_id)
  WHERE on_chain_proposal_id IS NOT NULL;
```

---

### 2. Voter Assignments (Who Votes on What)

```sql
CREATE TABLE voter_assignments (
  id BIGSERIAL PRIMARY KEY,
  match_proposal_id BIGINT NOT NULL REFERENCES match_proposals(id) ON DELETE CASCADE,
  voter_address TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified BOOLEAN NOT NULL DEFAULT FALSE,

  -- Prevent duplicate assignments
  UNIQUE(match_proposal_id, voter_address)
);

-- Voter-centric lookup (critical for feed)
CREATE INDEX idx_voter_assignments_voter ON voter_assignments(voter_address, match_proposal_id);

-- Match-centric lookup (count voters)
CREATE INDEX idx_voter_assignments_match ON voter_assignments(match_proposal_id);

-- Notification queue
CREATE INDEX idx_voter_assignments_pending_notification ON voter_assignments(assigned_at)
  WHERE notified = FALSE;
```

---

### 3. Vote Records (Auditability)

```sql
CREATE TABLE match_votes (
  id BIGSERIAL PRIMARY KEY,
  match_proposal_id BIGINT NOT NULL REFERENCES match_proposals(id) ON DELETE CASCADE,
  voter_address TEXT NOT NULL,
  vote_choice BOOLEAN NOT NULL, -- TRUE = yes, FALSE = no
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Blockchain verification
  on_chain_tx_hash TEXT,
  on_chain_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Prevent double voting
  UNIQUE(match_proposal_id, voter_address)
);

-- Match vote history
CREATE INDEX idx_match_votes_match ON match_votes(match_proposal_id, voted_at DESC);

-- Voter history
CREATE INDEX idx_match_votes_voter ON match_votes(voter_address, voted_at DESC);

-- Pending on-chain confirmation
CREATE INDEX idx_match_votes_pending_confirmation ON match_votes(on_chain_confirmed, voted_at)
  WHERE on_chain_confirmed = FALSE;
```

---

### 4. Match Generation Queue (Continuous Supply)

```sql
CREATE TABLE match_generation_queue (
  id BIGSERIAL PRIMARY KEY,
  user_a_address TEXT NOT NULL,
  user_b_address TEXT NOT NULL,
  pair_hash TEXT UNIQUE NOT NULL, -- Same hash as match_proposals for deduplication

  ai_compatibility_score DECIMAL(3,2) NOT NULL,
  compatibility_reasons JSONB NOT NULL DEFAULT '[]',

  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ, -- When converted to match_proposal

  CONSTRAINT valid_queue_pair CHECK (user_a_address < user_b_address)
);

-- Queue processing (highest score first)
CREATE INDEX idx_queue_unconsumed ON match_generation_queue(ai_compatibility_score DESC, generated_at ASC)
  WHERE consumed_at IS NULL;

-- Cleanup old consumed entries
CREATE INDEX idx_queue_cleanup ON match_generation_queue(consumed_at)
  WHERE consumed_at IS NOT NULL;
```

---

### 5. Conversations (Unlocked on Approval)

```sql
CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  match_proposal_id BIGINT UNIQUE NOT NULL REFERENCES match_proposals(id),
  user_a_address TEXT NOT NULL,
  user_b_address TEXT NOT NULL,

  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,

  -- Redundancy check
  CONSTRAINT matches_proposal CHECK (
    EXISTS (
      SELECT 1 FROM match_proposals mp
      WHERE mp.id = match_proposal_id
      AND mp.user_a_address = user_a_address
      AND mp.user_b_address = user_b_address
      AND mp.status = 'approved'
    )
  )
);

-- User conversation access
CREATE INDEX idx_conversations_user_a ON conversations(user_a_address, unlocked_at DESC);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_address, unlocked_at DESC);

CREATE TABLE conversation_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_address TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Conversation message stream
CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(conversation_id, sent_at ASC);

-- Unread messages
CREATE INDEX idx_conversation_messages_unread ON conversation_messages(conversation_id, read_at)
  WHERE read_at IS NULL;
```

---

### 6. System Metrics (Monitoring)

```sql
CREATE TABLE system_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_name_time ON system_metrics(metric_name, recorded_at DESC);
```

---

## 🔄 State Machine Lifecycle

```
┌─────────────┐
│  PROPOSED   │ ← Match created from queue
└──────┬──────┘
       │ (assign voters + create on-chain proposal)
       ↓
┌─────────────┐
│   VOTING    │ ← Active voting period
└──┬────┬──┬──┘
   │    │  │
   │    │  └─→ (expires) ──────────────┐
   │    │                                ↓
   │    └─→ (no_votes >= threshold) ─→ REJECTED
   │
   └─→ (yes_votes >= threshold) ─────→ APPROVED → Conversation unlocked

Any state ──→ (admin action/user report) ──→ BLOCKED
```

### State Transition Functions:

```typescript
// Transition: proposed → voting
async function startVoting(matchId: number) {
  const voters = await assignRandomVoters(matchId, 10);
  const txHash = await createOnChainProposal(matchId);

  await db.update('match_proposals', matchId, {
    status: 'voting',
    voting_started_at: new Date(),
    voting_expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    on_chain_tx_hash: txHash,
  });
}

// Transition: voting → approved
async function approveMatch(matchId: number) {
  await db.update('match_proposals', matchId, {
    status: 'approved',
    finalized_at: new Date(),
  });

  const proposal = await db.get('match_proposals', matchId);

  // Create conversation
  await db.insert('conversations', {
    match_proposal_id: matchId,
    user_a_address: proposal.user_a_address,
    user_b_address: proposal.user_b_address,
  });

  // Notify users
  await notifyUsers([proposal.user_a_address, proposal.user_b_address], matchId);
}

// Transition: voting → rejected/expired
async function rejectMatch(matchId: number, reason: 'rejected' | 'expired') {
  await db.update('match_proposals', matchId, {
    status: reason,
    finalized_at: new Date(),
  });
}
```

---

## ⚡ Background Jobs (Continuous Operation)

### Job 1: Match Generator (Every 5 minutes)

```typescript
/**
 * Ensures the queue always has 50-100 matches ready
 */
async function matchGeneratorJob() {
  const queueDepth = await db.count('match_generation_queue', { consumed_at: null });
  const targetDepth = 75;

  if (queueDepth < 50) {
    console.log(`Queue low (${queueDepth}), generating ${targetDepth - queueDepth} matches`);

    // Fetch all profiles
    const profiles = await supabase.from('profiles').select('*');

    // Get existing pairs (both in proposals and queue)
    const existingPairs = await getExistingPairHashes();

    // Generate new pairs
    const newPairs = await zeroGClient.generateMatchPairs({
      allProfiles: profiles,
      pairsToGenerate: targetDepth - queueDepth,
    });

    // Filter out duplicates
    const uniquePairs = newPairs.filter(p => {
      const hash = generatePairHash(p.userA, p.userB);
      return !existingPairs.has(hash);
    });

    // Insert into queue
    await db.insertMany('match_generation_queue', uniquePairs.map(p => ({
      user_a_address: p.userA,
      user_b_address: p.userB,
      pair_hash: generatePairHash(p.userA, p.userB),
      ai_compatibility_score: p.score,
      compatibility_reasons: p.compatibility,
    })));

    console.log(`Generated ${uniquePairs.length} new matches`);
  }
}
```

---

### Job 2: Proposal Creator (Every 1 minute)

```typescript
/**
 * Converts queued matches into active proposals
 * Maintains 10-15 active voting proposals at all times
 */
async function proposalCreatorJob() {
  const activeVoting = await db.count('match_proposals', { status: 'voting' });
  const targetActive = 12;

  if (activeVoting < 10) {
    const needed = targetActive - activeVoting;

    // Pull from queue (highest scores first)
    const queuedMatches = await db.query(`
      SELECT * FROM match_generation_queue
      WHERE consumed_at IS NULL
      ORDER BY ai_compatibility_score DESC, generated_at ASC
      LIMIT ${needed}
    `);

    for (const match of queuedMatches) {
      try {
        // Create proposal
        const proposalId = await db.insert('match_proposals', {
          user_a_address: match.user_a_address,
          user_b_address: match.user_b_address,
          pair_hash: match.pair_hash,
          ai_compatibility_score: match.ai_compatibility_score,
          compatibility_reasons: match.compatibility_reasons,
          status: 'proposed',
        });

        // Assign voters (exclude the matched pair)
        const voters = await assignRandomVoters(proposalId, 10, [
          match.user_a_address,
          match.user_b_address,
        ]);

        // Create on-chain proposal
        const txHash = await createOnChainProposal(proposalId);

        // Transition to voting
        await db.update('match_proposals', proposalId, {
          status: 'voting',
          voting_started_at: new Date(),
          voting_expires_at: new Date(Date.now() + 10 * 60 * 1000),
          on_chain_tx_hash: txHash,
        });

        // Mark queue entry as consumed
        await db.update('match_generation_queue', match.id, {
          consumed_at: new Date(),
        });

        console.log(`Created proposal ${proposalId} from queue`);
      } catch (error) {
        console.error(`Failed to create proposal:`, error);
      }
    }
  }
}
```

---

### Job 3: Expiration Handler (Every 1 minute)

```typescript
/**
 * Handles expired proposals
 */
async function expirationHandlerJob() {
  const expired = await db.query(`
    SELECT * FROM match_proposals
    WHERE status = 'voting'
    AND voting_expires_at < NOW()
  `);

  for (const proposal of expired) {
    try {
      // Finalize on-chain
      await finalizeOnChain(proposal.on_chain_proposal_id);

      // Determine outcome
      const status = proposal.yes_votes > proposal.no_votes ? 'approved' : 'rejected';

      await db.update('match_proposals', proposal.id, {
        status,
        finalized_at: new Date(),
      });

      if (status === 'approved') {
        await approveMatch(proposal.id);
      }

      console.log(`Finalized expired proposal ${proposal.id}: ${status}`);
    } catch (error) {
      console.error(`Failed to finalize proposal ${proposal.id}:`, error);
    }
  }
}
```

---

### Job 4: Vote Sync (Event-driven or Every 30 seconds)

```typescript
/**
 * Syncs on-chain votes to database
 */
async function voteSyncJob() {
  // Listen to Vote events from contract
  const recentVotes = await getRecentVoteEvents();

  for (const event of recentVotes) {
    const { matchId, voter, support, yesVotes, noVotes } = event;

    // Update vote record
    await db.update('match_votes',
      { match_proposal_id: matchId, voter_address: voter },
      { on_chain_confirmed: true, on_chain_tx_hash: event.txHash }
    );

    // Update proposal vote counts
    await db.update('match_proposals', matchId, {
      yes_votes: yesVotes,
      no_votes: noVotes,
      total_votes_cast: yesVotes + noVotes,
    });

    // Check for early close
    const proposal = await db.get('match_proposals', matchId);

    if (proposal.yes_votes >= proposal.approval_threshold) {
      await approveMatch(matchId);
    } else if (proposal.no_votes >= proposal.rejection_threshold) {
      await rejectMatch(matchId, 'rejected');
    }
  }
}
```

---

### Job 5: Queue Cleanup (Daily at 3 AM)

```typescript
/**
 * Archives old consumed queue entries
 */
async function queueCleanupJob() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  await db.query(`
    DELETE FROM match_generation_queue
    WHERE consumed_at < $1
  `, [cutoff]);
}
```

---

## 🔍 Efficient Lookups

### Query 1: Get Matches to Vote On (Voter Feed)

```sql
SELECT
  mp.*,
  pa.name as user_a_name, pa.age as user_a_age, pa.location as user_a_location, pa.image_url as user_a_image,
  pb.name as user_b_name, pb.age as user_b_age, pb.location as user_b_location, pb.image_url as user_b_image
FROM voter_assignments va
JOIN match_proposals mp ON va.match_proposal_id = mp.id
JOIN profiles pa ON mp.user_a_address = pa.wallet_address
JOIN profiles pb ON mp.user_b_address = pb.wallet_address
WHERE va.voter_address = $1
  AND mp.status = 'voting'
  AND NOT EXISTS (
    SELECT 1 FROM match_votes mv
    WHERE mv.match_proposal_id = mp.id
    AND mv.voter_address = $1
  )
ORDER BY mp.created_at ASC
LIMIT 20;
```

---

### Query 2: Get My Matches (User's Approved Matches)

```sql
SELECT
  mp.*,
  c.id as conversation_id,
  c.last_message_at,
  CASE
    WHEN mp.user_a_address = $1 THEN p.name
    ELSE pa.name
  END as partner_name,
  CASE
    WHEN mp.user_a_address = $1 THEN p.image_url
    ELSE pa.image_url
  END as partner_image
FROM match_proposals mp
LEFT JOIN conversations c ON mp.id = c.match_proposal_id
LEFT JOIN profiles pa ON mp.user_a_address = pa.wallet_address
LEFT JOIN profiles pb ON mp.user_b_address = pb.wallet_address
WHERE (mp.user_a_address = $1 OR mp.user_b_address = $1)
  AND mp.status = 'approved'
ORDER BY c.last_message_at DESC NULLS LAST;
```

---

### Query 3: Get Proposals Involving Me (All Statuses)

```sql
SELECT
  mp.*,
  pa.name as user_a_name,
  pb.name as user_b_name
FROM match_proposals mp
JOIN profiles pa ON mp.user_a_address = pa.wallet_address
JOIN profiles pb ON mp.user_b_address = pb.wallet_address
WHERE mp.user_a_address = $1 OR mp.user_b_address = $1
ORDER BY mp.created_at DESC;
```

---

## 🔐 Privacy Gating

### Public Profile View (Before Match)

```sql
CREATE VIEW public_profiles AS
SELECT
  wallet_address,
  name,
  age,
  location,
  image_url,
  created_at
FROM profiles;
-- Note: answers_json and embedding are NOT exposed
```

### Conversation Access Control

```sql
-- RLS Policy: Users can only access conversations they're part of
CREATE POLICY "conversation_access" ON conversation_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT c.id
      FROM conversations c
      JOIN match_proposals mp ON c.match_proposal_id = mp.id
      WHERE mp.status = 'approved'
        AND (
          c.user_a_address = current_setting('app.current_user')::text
          OR c.user_b_address = current_setting('app.current_user')::text
        )
    )
  );
```

---

## 📊 Preventing Duplicates

### Pair Hash Generation

```typescript
function generatePairHash(userA: string, userB: string): string {
  // Always sort addresses to ensure consistency
  const addresses = [userA.toLowerCase(), userB.toLowerCase()].sort();
  return keccak256(encodePacked(['address', 'address'], addresses));
}
```

### Check Before Creating

```typescript
async function canCreateProposal(userA: string, userB: string): Promise<boolean> {
  const hash = generatePairHash(userA, userB);

  // Check in proposals
  const existingProposal = await db.findOne('match_proposals', { pair_hash: hash });
  if (existingProposal && existingProposal.status !== 'rejected' && existingProposal.status !== 'expired') {
    return false; // Active or approved proposal exists
  }

  // Check in queue
  const inQueue = await db.findOne('match_generation_queue', {
    pair_hash: hash,
    consumed_at: null
  });
  if (inQueue) {
    return false; // Already queued
  }

  return true;
}
```

---

## 📈 Scaling Strategy

### 1. Partitioning

```sql
-- Partition by status for faster queries
CREATE TABLE match_proposals_voting PARTITION OF match_proposals
  FOR VALUES IN ('voting');

CREATE TABLE match_proposals_approved PARTITION OF match_proposals
  FOR VALUES IN ('approved');

CREATE TABLE match_proposals_finalized PARTITION OF match_proposals
  FOR VALUES IN ('rejected', 'expired', 'blocked');
```

### 2. Archiving

```sql
-- Move old finalized matches to archive table
CREATE TABLE match_proposals_archive (LIKE match_proposals);

-- Monthly archive job
INSERT INTO match_proposals_archive
SELECT * FROM match_proposals
WHERE finalized_at < NOW() - INTERVAL '90 days'
  AND status IN ('rejected', 'expired', 'blocked');

DELETE FROM match_proposals
WHERE finalized_at < NOW() - INTERVAL '90 days'
  AND status IN ('rejected', 'expired', 'blocked');
```

### 3. Caching Layer (Redis)

```typescript
// Cache voter assignments
const cachedAssignments = await redis.get(`voter:${address}:assignments`);
if (!cachedAssignments) {
  const assignments = await db.query(/* ... */);
  await redis.setex(`voter:${address}:assignments`, 60, JSON.stringify(assignments));
}
```

### 4. Read Replicas

- Route all read queries (feeds, lookups) to read replicas
- Route writes (votes, proposals) to primary
- Use connection pooling (pgBouncer)

---

## 🎛️ Admin Dashboard Queries

### System Health Check

```sql
SELECT
  (SELECT COUNT(*) FROM match_generation_queue WHERE consumed_at IS NULL) as queue_depth,
  (SELECT COUNT(*) FROM match_proposals WHERE status = 'voting') as active_voting,
  (SELECT COUNT(*) FROM match_proposals WHERE status = 'approved' AND finalized_at > NOW() - INTERVAL '24 hours') as approved_today,
  (SELECT AVG(total_votes_cast) FROM match_proposals WHERE status IN ('approved', 'rejected')) as avg_votes_per_match;
```

### Performance Metrics

```sql
-- Average time from proposed to finalized
SELECT
  AVG(EXTRACT(EPOCH FROM (finalized_at - created_at))) / 60 as avg_minutes_to_finalize
FROM match_proposals
WHERE finalized_at IS NOT NULL;

-- Vote distribution
SELECT
  status,
  COUNT(*) as count,
  AVG(yes_votes) as avg_yes,
  AVG(no_votes) as avg_no
FROM match_proposals
GROUP BY status;
```

---

## 🚀 Deployment Checklist

1. ✅ Run all schema migrations
2. ✅ Set up background job scheduler (cron or node-cron)
3. ✅ Configure job intervals
4. ✅ Enable RLS policies
5. ✅ Set up monitoring alerts
6. ✅ Seed initial profiles
7. ✅ Run first match generation
8. ✅ Verify queue depth > 50

---

## 📝 Summary

- **Data Model**: Relational with clear state machine
- **Uniqueness**: pair_hash ensures no duplicates
- **Continuous Supply**: Background jobs maintain queue + active proposals
- **Efficient Lookups**: Comprehensive indexes for all query patterns
- **Privacy**: RLS + views limit data exposure
- **Scalability**: Partitioning, archiving, caching, replicas
- **Auditability**: All votes and transitions logged

This architecture ensures users **always** have matches to vote on and the system scales cleanly!
