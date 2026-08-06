-- Challenge types table
CREATE TABLE IF NOT EXISTS challenge_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT,
  default_xp INTEGER NOT NULL DEFAULT 50,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default challenge types
INSERT INTO challenge_types (id, name, unit, default_xp, icon, sort_order, active) VALUES
  ('workouts',      'Entrenamiento',   'entrenamientos', 125, '🏋️', 1, TRUE),
  ('streak',        'Racha',           'días',           175, '🔥', 2, TRUE),
  ('calories',      'Calorías',        'kcal',           100, '⚡', 3, TRUE),
  ('distance',      'Distancia',       'km',             110, '🏃', 4, TRUE),
  ('weight_lifted', 'Peso levantado',  'kg',             200, '💪', 5, TRUE),
  ('social',        'Social',          'interacciones',   75, '👥', 6, TRUE),
  ('custom',        'Personalizado',   'unidades',        50, '🎯', 7, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Add session flow columns to challenge_participants
ALTER TABLE challenge_participants
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'joined',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accumulated_ms BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ;
