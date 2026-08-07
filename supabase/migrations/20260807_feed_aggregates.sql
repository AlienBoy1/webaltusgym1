-- Fast aggregates for social feed (avoids loading every like/comment row)
CREATE OR REPLACE FUNCTION public.feed_comment_counts(pids uuid[])
RETURNS TABLE(post_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.post_id, COUNT(*)::bigint
  FROM post_comments c
  WHERE pids IS NOT NULL AND c.post_id = ANY (pids)
  GROUP BY c.post_id;
$$;

CREATE OR REPLACE FUNCTION public.feed_reaction_stats(pids uuid[])
RETURNS TABLE(post_id uuid, emoji text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.post_id,
    COALESCE(NULLIF(l.emoji, ''), '❤️') AS emoji,
    COUNT(*)::bigint
  FROM post_likes l
  WHERE pids IS NOT NULL AND l.post_id = ANY (pids)
  GROUP BY l.post_id, COALESCE(NULLIF(l.emoji, ''), '❤️');
$$;

CREATE INDEX IF NOT EXISTS idx_posts_user_created_at
  ON public.posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id
  ON public.post_likes (post_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
  ON public.post_comments (post_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id
  ON public.follows (follower_id);

GRANT EXECUTE ON FUNCTION public.feed_comment_counts(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.feed_reaction_stats(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.feed_comment_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_reaction_stats(uuid[]) TO authenticated;
