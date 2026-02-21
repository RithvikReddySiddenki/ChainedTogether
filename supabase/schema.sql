-- ChainedTogether Database Schema
-- Run this in Supabase SQL Editor

-- =====================
-- TABLES
-- =====================

-- Profiles table
CREATE TABLE profiles (
  wallet_address TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT,                                  -- Free-text bio for AI matchmaking
  age INTEGER NOT NULL CHECK (age >= 18),
  location TEXT NOT NULL,
  image_url TEXT NOT NULL,
  answers_json JSONB NOT NULL DEFAULT '{}',  -- ExtractedProfile structure (never shown to matches)
  embedding JSONB NOT NULL DEFAULT '[]',     -- float[] as JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intake sessions table
CREATE TABLE intake_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intake messages table
CREATE TABLE intake_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES intake_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('agent', 'user')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chats (
  id BIGSERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL,  -- References on-chain proposal ID
  sender TEXT NOT NULL,       -- wallet_address
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================

CREATE INDEX idx_intake_sessions_wallet ON intake_sessions(wallet_address);
CREATE INDEX idx_intake_messages_session ON intake_messages(session_id);
CREATE INDEX idx_chats_match_id ON chats(match_id);
CREATE INDEX idx_chats_sender ON chats(sender);
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- =====================
-- ROW LEVEL SECURITY (RLS)
-- =====================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can read (for browsing matches)
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  USING (true);

-- Profiles: Users can insert/update their own profile
CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT
  WITH CHECK (true);  -- Allow anyone to create profile

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Intake sessions: Users can manage their own sessions
CREATE POLICY "Users can read their own intake sessions"
  ON intake_sessions FOR SELECT
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can create their own intake sessions"
  ON intake_sessions FOR INSERT
  WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Users can update their own intake sessions"
  ON intake_sessions FOR UPDATE
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Intake messages: Users can read messages from their sessions
CREATE POLICY "Users can read messages from their sessions"
  ON intake_messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM intake_sessions
      WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    )
  );

CREATE POLICY "Users can insert messages to their sessions"
  ON intake_messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM intake_sessions
      WHERE wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    )
  );

-- Chats: RLS enforced via Next.js API route (checks on-chain approval)
-- For simplicity, allow authenticated reads (API route does the real gating)
CREATE POLICY "Authenticated users can read chats"
  ON chats FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert chats"
  ON chats FOR INSERT
  WITH CHECK (true);

-- =====================
-- FUNCTIONS & TRIGGERS
-- =====================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intake_sessions_updated_at
  BEFORE UPDATE ON intake_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================
-- NOTES ON SECURITY
-- =====================

-- For production:
-- 1. Chat RLS is permissive; actual gating happens in Next.js API route
--    (verifies on-chain approval before returning messages)
-- 2. If using Supabase Auth, replace current_setting checks with auth.uid()
-- 3. For demo without Supabase Auth, you can disable RLS temporarily:
--    ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
--    (etc for other tables)
