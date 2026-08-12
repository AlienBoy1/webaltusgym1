-- APPLY NOW: body check-ins for Progress hub
CREATE TABLE IF NOT EXISTS body_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  weight_kg numeric,
  body_fat_pct numeric,
  waist_cm numeric,
  hip_cm numeric,
  note text,
  source text NOT NULL DEFAULT 'manual',
  CONSTRAINT body_checkins_weight_range CHECK (weight_kg IS NULL OR (weight_kg >= 30 AND weight_kg <= 300)),
  CONSTRAINT body_checkins_bf_range CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 3 AND body_fat_pct <= 60)),
  CONSTRAINT body_checkins_waist_range CHECK (waist_cm IS NULL OR (waist_cm >= 40 AND waist_cm <= 200)),
  CONSTRAINT body_checkins_hip_range CHECK (hip_cm IS NULL OR (hip_cm >= 40 AND hip_cm <= 200)),
  CONSTRAINT body_checkins_has_metric CHECK (
    weight_kg IS NOT NULL OR body_fat_pct IS NOT NULL OR waist_cm IS NOT NULL OR hip_cm IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS body_checkins_user_recorded_idx
  ON body_checkins (user_id, recorded_at DESC);

COMMENT ON TABLE body_checkins IS 'User body metric check-ins for Progress hub charts';
