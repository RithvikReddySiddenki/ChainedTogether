-- Add bio column to profiles for richer AI matchmaking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Recreate the public_profiles view to include bio
-- (DROP + CREATE because CREATE OR REPLACE cannot reorder existing columns)
DROP VIEW IF EXISTS public_profiles;
CREATE VIEW public_profiles AS
SELECT
  wallet_address,
  name,
  bio,
  age,
  location,
  image_url,
  created_at
FROM profiles;
