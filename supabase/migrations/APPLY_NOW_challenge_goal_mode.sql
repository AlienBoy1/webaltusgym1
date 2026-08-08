-- APPLY NOW: Time-based challenge goals + exercise result after timer completion
-- Run in Supabase SQL Editor if migrations are not applied automatically.

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS goal_mode TEXT NOT NULL DEFAULT 'quantity';

ALTER TABLE challenge_participants
  ADD COLUMN IF NOT EXISTS result_value NUMERIC,
  ADD COLUMN IF NOT EXISTS result_unit TEXT;
