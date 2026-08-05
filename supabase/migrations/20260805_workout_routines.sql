-- Public/shareable workout routines (GymRat)
CREATE TABLE IF NOT EXISTS workout_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  local_id text,
  name text NOT NULL,
  color text DEFAULT 'primary',
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_routines_user_id_idx ON workout_routines(user_id);
CREATE INDEX IF NOT EXISTS workout_routines_public_idx ON workout_routines(is_public) WHERE is_public = true;
CREATE UNIQUE INDEX IF NOT EXISTS workout_routines_user_local_uidx
  ON workout_routines(user_id, local_id)
  WHERE local_id IS NOT NULL;
