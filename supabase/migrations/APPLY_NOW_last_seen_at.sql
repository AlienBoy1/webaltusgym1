-- Apply now in Supabase SQL editor if migrations are not auto-run.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
