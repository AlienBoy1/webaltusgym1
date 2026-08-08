-- Time-based challenge goals + exercise result after timer completion
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS goal_mode TEXT NOT NULL DEFAULT 'quantity';

ALTER TABLE challenge_participants
  ADD COLUMN IF NOT EXISTS result_value NUMERIC,
  ADD COLUMN IF NOT EXISTS result_unit TEXT;

COMMENT ON COLUMN challenges.goal_mode IS 'quantity | time — time goals complete via chronometer';
COMMENT ON COLUMN challenge_participants.result_value IS 'Secondary exercise result after time-goal completion (reps/km)';
