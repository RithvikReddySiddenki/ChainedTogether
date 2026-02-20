-- Add accept/decline columns to conversations table
-- Each matched user can independently accept or decline
-- Chat only opens when both accept (user_a_accepted = true AND user_b_accepted = true)

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS user_a_accepted BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_b_accepted BOOLEAN DEFAULT NULL;

-- Index for querying pending accepts
CREATE INDEX IF NOT EXISTS idx_conversations_pending_accept
  ON conversations(user_a_accepted, user_b_accepted)
  WHERE user_a_accepted IS NULL OR user_b_accepted IS NULL;

SELECT 'Migration 002: accept/decline columns added' as status;
