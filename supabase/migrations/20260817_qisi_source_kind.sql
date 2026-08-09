-- QySi (Sistema inteligente Qyntra interno) support columns
ALTER TABLE workout_routines
  ADD COLUMN IF NOT EXISTS source_kind text;

CREATE INDEX IF NOT EXISTS workout_routines_source_kind_idx
  ON workout_routines(source_kind)
  WHERE source_kind IS NOT NULL;

COMMENT ON COLUMN workout_routines.source_kind IS 'Provenance marker, e.g. qisi for QySi (Sistema inteligente Qyntra interno)';
