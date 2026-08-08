-- APPLY NOW: collaborator flag for edited adopted routines
ALTER TABLE workout_routines
  ADD COLUMN IF NOT EXISTS is_edited_fork boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collaborator_at timestamptz;

CREATE INDEX IF NOT EXISTS workout_routines_source_edited_idx
  ON workout_routines(source_routine_id)
  WHERE is_edited_fork = true;
