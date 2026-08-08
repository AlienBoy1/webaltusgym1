-- APPLY NOW in Supabase SQL Editor
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS exercises jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS exercise_progress jsonb NOT NULL DEFAULT '{}'::jsonb;
  