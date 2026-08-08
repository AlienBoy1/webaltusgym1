-- APPLY NOW: GymRat provenance + adopt counter (run in Supabase SQL editor if needed)
ALTER TABLE workout_routines
  ADD COLUMN IF NOT EXISTS source_routine_id uuid REFERENCES workout_routines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_creator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adopt_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS workout_routines_source_idx
  ON workout_routines(source_routine_id)
  WHERE source_routine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workout_routines_original_creator_idx
  ON workout_routines(original_creator_id)
  WHERE original_creator_id IS NOT NULL;

UPDATE workout_routines
SET original_creator_id = user_id
WHERE original_creator_id IS NULL;
