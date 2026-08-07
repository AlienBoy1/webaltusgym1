CREATE TABLE IF NOT EXISTS chat_clears (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  peer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cleared_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, peer_id)
);
CREATE INDEX IF NOT EXISTS chat_clears_user_idx ON chat_clears(user_id);
