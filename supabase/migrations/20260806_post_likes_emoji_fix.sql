-- CRITICAL: without this column, every non-heart reaction falls back to ❤️
-- Paste into Supabase → SQL Editor → Run

ALTER TABLE post_likes
  ADD COLUMN IF NOT EXISTS emoji text DEFAULT '❤️';

UPDATE post_likes
SET emoji = '❤️'
WHERE emoji IS NULL;

COMMENT ON COLUMN post_likes.emoji IS 'Reaction emoji (❤️ 💪 🧴 🔥 ⚡ 🏆)';
-- o si o se hizo correctamente, se puede eliminar el comentario