-- ChainedTogether Complete Schema Migration
-- This replaces the previous schema with the full lifecycle management system

-- Drop old tables if they exist
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS intake_messages CASCADE;
DROP TABLE IF EXISTS intake_sessions CASCADE;
DROP TABLE IF EXISTS match_voters CASCADE;
DROP VIEW IF EXISTS public_profiles CASCADE;

-- Keep profiles table but ensure it has correct structure
-- (Assuming it exists from earlier setup)

-- =====================================================
-- 1. MATCH PROPOSALS (Core State Machine)
-- =====================================================

CREATE TABLE IF NOT EXISTS match_proposals (
  id BIGSERIAL PRIMARY KEY,

  -- Pair identification
  user_a_address TEXT NOT NULL,
  user_b_address TEXT NOT NULL,
  pair_hash TEXT UNIQUE NOT NULL,

  -- AI matching data
  ai_compatibility_score DECIMAL(3,2) NOT NULL CHECK (ai_compatibility_score >= 0 AND ai_compatibility_score <= 1),
  compatibility_reasons JSONB NOT NULL DEFAULT '[]',

  -- Lifecycle state
  status TEXT NOT NULL CHECK (status IN ('proposed', 'voting', 'approved', 'rejected', 'expired', 'blocked')) DEFAULT 'proposed',

  -- Blockchain reference
  on_chain_proposal_id INTEGER UNIQUE,
  on_chain_tx_hash TEXT,

  -- Voting metadata
  yes_votes INTEGER NOT NULL DEFAULT 0,
  no_votes INTEGER NOT NULL DEFAULT 0,
  total_votes_cast INTEGER NOT NULL DEFAULT 0,
  quorum_required INTEGER NOT NULL DEFAULT 10,
  approval_threshold INTEGER NOT NULL DEFAULT 5,
  rejection_threshold INTEGER NOT NULL DEFAULT 5,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voting_started_at TIMESTAMPTZ,
  voting_expires_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_pair CHECK (user_a_address < user_b_address),
  CONSTRAINT valid_voting_window CHECK (voting_expires_at > voting_started_at OR voting_expires_at IS NULL),
  CONSTRAINT valid_vote_counts CHECK (yes_votes >= 0 AND no_votes >= 0 AND total_votes_cast = yes_votes + no_votes)
);

-- Indexes
CREATE UNIQUE INDEX idx_match_proposals_pair_hash ON match_proposals(pair_hash);
CREATE INDEX idx_match_proposals_user_a ON match_proposals(user_a_address, status, created_at DESC);
CREATE INDEX idx_match_proposals_user_b ON match_proposals(user_b_address, status, created_at DESC);
CREATE INDEX idx_match_proposals_status ON match_proposals(status, created_at DESC);
CREATE INDEX idx_match_proposals_expiring ON match_proposals(voting_expires_at, status)
  WHERE status = 'voting' AND voting_expires_at IS NOT NULL;
CREATE INDEX idx_match_proposals_on_chain ON match_proposals(on_chain_proposal_id)
  WHERE on_chain_proposal_id IS NOT NULL;

-- =====================================================
-- 2. VOTER ASSIGNMENTS
-- =====================================================

CREATE TABLE voter_assignments (
  id BIGSERIAL PRIMARY KEY,
  match_proposal_id BIGINT NOT NULL REFERENCES match_proposals(id) ON DELETE CASCADE,
  voter_address TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified BOOLEAN NOT NULL DEFAULT FALSE,

  UNIQUE(match_proposal_id, voter_address)
);

CREATE INDEX idx_voter_assignments_voter ON voter_assignments(voter_address, match_proposal_id);
CREATE INDEX idx_voter_assignments_match ON voter_assignments(match_proposal_id);
CREATE INDEX idx_voter_assignments_pending_notification ON voter_assignments(assigned_at)
  WHERE notified = FALSE;

-- =====================================================
-- 3. VOTE RECORDS
-- =====================================================

CREATE TABLE match_votes (
  id BIGSERIAL PRIMARY KEY,
  match_proposal_id BIGINT NOT NULL REFERENCES match_proposals(id) ON DELETE CASCADE,
  voter_address TEXT NOT NULL,
  vote_choice BOOLEAN NOT NULL,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  on_chain_tx_hash TEXT,
  on_chain_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

  UNIQUE(match_proposal_id, voter_address)
);

CREATE INDEX idx_match_votes_match ON match_votes(match_proposal_id, voted_at DESC);
CREATE INDEX idx_match_votes_voter ON match_votes(voter_address, voted_at DESC);
CREATE INDEX idx_match_votes_pending_confirmation ON match_votes(on_chain_confirmed, voted_at)
  WHERE on_chain_confirmed = FALSE;

-- =====================================================
-- 4. MATCH GENERATION QUEUE
-- =====================================================

CREATE TABLE match_generation_queue (
  id BIGSERIAL PRIMARY KEY,
  user_a_address TEXT NOT NULL,
  user_b_address TEXT NOT NULL,
  pair_hash TEXT UNIQUE NOT NULL,

  ai_compatibility_score DECIMAL(3,2) NOT NULL,
  compatibility_reasons JSONB NOT NULL DEFAULT '[]',

  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,

  CONSTRAINT valid_queue_pair CHECK (user_a_address < user_b_address)
);

CREATE INDEX idx_queue_unconsumed ON match_generation_queue(ai_compatibility_score DESC, generated_at ASC)
  WHERE consumed_at IS NULL;
CREATE INDEX idx_queue_cleanup ON match_generation_queue(consumed_at)
  WHERE consumed_at IS NOT NULL;

-- =====================================================
-- 5. CONVERSATIONS (Unlocked on approval)
-- =====================================================

CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  match_proposal_id BIGINT UNIQUE NOT NULL REFERENCES match_proposals(id),
  user_a_address TEXT NOT NULL,
  user_b_address TEXT NOT NULL,

  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_user_a ON conversations(user_a_address, unlocked_at DESC);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_address, unlocked_at DESC);
CREATE INDEX idx_conversations_match ON conversations(match_proposal_id);

CREATE TABLE conversation_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_address TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(conversation_id, sent_at ASC);
CREATE INDEX idx_conversation_messages_unread ON conversation_messages(conversation_id, read_at)
  WHERE read_at IS NULL;

-- =====================================================
-- 6. SYSTEM METRICS
-- =====================================================

CREATE TABLE system_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_metrics_name_time ON system_metrics(metric_name, recorded_at DESC);

-- =====================================================
-- VIEWS
-- =====================================================

-- Public profile view (limited fields)
CREATE OR REPLACE VIEW public_profiles AS
SELECT
  wallet_address,
  name,
  age,
  location,
  image_url,
  created_at
FROM profiles;

-- Match voting stats
CREATE OR REPLACE VIEW match_voting_stats AS
SELECT
  mp.id as match_id,
  mp.status,
  mp.yes_votes,
  mp.no_votes,
  mp.total_votes_cast,
  mp.quorum_required,
  COUNT(va.id) as voters_assigned,
  COUNT(mv.id) as votes_cast,
  mp.voting_expires_at,
  CASE
    WHEN mp.voting_expires_at < NOW() THEN TRUE
    ELSE FALSE
  END as is_expired
FROM match_proposals mp
LEFT JOIN voter_assignments va ON mp.id = va.match_proposal_id
LEFT JOIN match_votes mv ON mp.id = mv.match_proposal_id
GROUP BY mp.id;

-- =====================================================
-- RLS POLICIES (Disabled for demo)
-- =====================================================

ALTER TABLE match_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE voter_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_generation_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics DISABLE ROW LEVEL SECURITY;

-- For production, enable RLS and add policies like:
-- CREATE POLICY "voters_see_assigned" ON voter_assignments FOR SELECT
--   USING (voter_address = current_setting('app.current_user')::text);

SELECT 'Schema migration completed successfully!' as status;
