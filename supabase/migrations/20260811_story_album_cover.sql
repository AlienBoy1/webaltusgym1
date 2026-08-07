-- Custom cover for story favorite albums
ALTER TABLE public.story_favorite_albums
  ADD COLUMN IF NOT EXISTS cover_url text;
