-- Reactions on post comments (same emoji set as post_likes)
CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL DEFAULT '❤️',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx
  ON public.comment_likes (comment_id);

COMMENT ON TABLE public.comment_likes IS 'Emoji reactions on comments (❤️ 💪 🧴 🔥 ⚡ 🏆)';
