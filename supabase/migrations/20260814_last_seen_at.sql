-- Persist last disconnection time for Messenger-style presence labels.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.last_seen_at IS 'Last time the user went offline / left presence';
