-- Voter Assignment System for Match Proposals
-- Run this in Supabase SQL Editor AFTER schema.sql

-- Table to track which users are assigned to vote on which matches
CREATE TABLE IF NOT EXISTS match_voters (
  id BIGSERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL,  -- References on-chain proposal ID
  voter_address TEXT NOT NULL,
  has_voted BOOLEAN NOT NULL DEFAULT FALSE,
  vote_choice BOOLEAN,  -- NULL if hasn't voted, TRUE for yes, FALSE for no
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voted_at TIMESTAMPTZ,
  UNIQUE(match_id, voter_address)  -- Each voter can only be assigned once per match
);

-- Indexes for performance
CREATE INDEX idx_match_voters_match_id ON match_voters(match_id);
CREATE INDEX idx_match_voters_voter ON match_voters(voter_address);
CREATE INDEX idx_match_voters_pending ON match_voters(match_id, has_voted) WHERE has_voted = FALSE;

-- Enable RLS
ALTER TABLE match_voters ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own assignments
CREATE POLICY "Users can read their own voter assignments"
  ON match_voters FOR SELECT
  USING (voter_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Policy: Anyone can see vote counts (for transparency)
CREATE POLICY "Anyone can read vote counts"
  ON match_voters FOR SELECT
  USING (true);

-- Policy: System can insert assignments (for now, allow all inserts for demo)
CREATE POLICY "Allow insert for match assignments"
  ON match_voters FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own votes
CREATE POLICY "Users can update their own votes"
  ON match_voters FOR UPDATE
  USING (voter_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Helper view: Get voting stats per match
CREATE OR REPLACE VIEW match_voting_stats AS
SELECT
  match_id,
  COUNT(*) as total_assigned,
  COUNT(*) FILTER (WHERE has_voted = TRUE) as votes_cast,
  COUNT(*) FILTER (WHERE vote_choice = TRUE) as yes_votes,
  COUNT(*) FILTER (WHERE vote_choice = FALSE) as no_votes
FROM match_voters
GROUP BY match_id;

-- For demo: Disable RLS on this table
ALTER TABLE match_voters DISABLE ROW LEVEL SECURITY;

SELECT 'Voter assignment system created successfully!' as status;
