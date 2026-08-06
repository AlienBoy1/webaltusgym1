-- Usernames for profiles (unique, optional until user sets one)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_ci
  ON profiles (lower(username))
  WHERE username IS NOT NULL AND username <> '';

COMMENT ON COLUMN profiles.username IS 'Public handle (@username), unique case-insensitive';
