-- Chat delivery receipts + post reaction emoji
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivered boolean NOT NULL DEFAULT false;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE post_likes
  ADD COLUMN IF NOT EXISTS emoji text DEFAULT '❤️';
