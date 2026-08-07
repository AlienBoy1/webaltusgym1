-- Profile notes (Facebook-style temporary notes, 24h)
-- One active note per user; auto-expire via expires_at.

CREATE TABLE IF NOT EXISTS profile_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT profile_notes_body_len CHECK (char_length(body) > 0 AND char_length(body) <= 60)
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_notes_one_active_user_idx
  ON profile_notes (user_id);

CREATE INDEX IF NOT EXISTS profile_notes_expires_at_idx ON profile_notes (expires_at);

CREATE TABLE IF NOT EXISTS profile_note_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES profile_notes(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_note_replies_body_len CHECK (char_length(body) > 0 AND char_length(body) <= 280)
);

CREATE INDEX IF NOT EXISTS profile_note_replies_note_id_idx ON profile_note_replies (note_id);
CREATE INDEX IF NOT EXISTS profile_note_replies_from_user_idx ON profile_note_replies (from_user_id);
