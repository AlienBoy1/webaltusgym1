-- Assign workout routines to specific weekdays (0=Sun … 6=Sat)
ALTER TABLE workout_routines
  ADD COLUMN IF NOT EXISTS days jsonb NOT NULL DEFAULT '[]'::jsonb;
