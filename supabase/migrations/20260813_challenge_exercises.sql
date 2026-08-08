-- Challenge exercise templates + per-participant exercise progress
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS exercises jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS exercise_progress jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.challenges.exercises IS
  'Exercise targets: [{id,name,targetReps}] used for progress fields';

COMMENT ON COLUMN public.challenge_participants.exercise_progress IS
  'Map of exerciseId -> done reps/quantity during the challenge';
