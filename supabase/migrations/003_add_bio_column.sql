-- Add bio column to profiles for richer AI matchmaking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Update the public_profiles view to include bio
CREATE OR REPLACE VIEW public_profiles AS
SELECT
  wallet_address,
  name,
  bio,
  age,
  location,
  image_url,
  created_at
FROM profiles;
