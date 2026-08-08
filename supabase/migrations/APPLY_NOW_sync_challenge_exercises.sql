-- Sync empty challenges.exercises from reward.exercises JSON (legacy creates)
UPDATE public.challenges c
SET exercises = c.reward->'exercises'
WHERE (c.exercises IS NULL OR c.exercises = '[]'::jsonb)
  AND jsonb_typeof(c.reward->'exercises') = 'array'
  AND jsonb_array_length(c.reward->'exercises') > 0;
