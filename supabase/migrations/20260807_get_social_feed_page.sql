-- One-round-trip social feed page (NO base64 images — list only; detail has media)
CREATE OR REPLACE FUNCTION public.get_social_feed_page(
  p_viewer uuid,
  p_before timestamptz DEFAULT NULL,
  p_limit int DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20);
  v_posts jsonb;
  v_has_more boolean;
BEGIN
  WITH follow_ids AS (
    SELECT f.following_id AS uid
    FROM follows f
    WHERE f.follower_id = p_viewer
    LIMIT 80
  ),
  feed_users AS (
    SELECT p_viewer AS uid
    UNION
    SELECT uid FROM follow_ids
  ),
  ranked AS (
    SELECT
      p.id,
      p.user_id,
      p.content,
      p.mood,
      p.poll,
      p.post_type,
      p.badge_data,
      p.workout_data,
      p.shared_from,
      p.created_at,
      p.updated_at,
      CASE
        WHEN p.images IS NULL THEN false
        WHEN pg_column_size(p.images) IS NULL THEN false
        WHEN pg_column_size(p.images) > 8 THEN true
        ELSE false
      END AS has_images
    FROM posts p
    WHERE p.user_id IN (SELECT uid FROM feed_users)
      AND (p_before IS NULL OR p.created_at < p_before)
    ORDER BY p.created_at DESC
    LIMIT v_limit + 1
  ),
  page AS (
    SELECT *
    FROM ranked
    ORDER BY created_at DESC
    LIMIT v_limit
  ),
  page_ids AS (
    SELECT id FROM page
  ),
  comment_counts AS (
    SELECT c.post_id, COUNT(*)::bigint AS cnt
    FROM post_comments c
    WHERE c.post_id IN (SELECT id FROM page_ids)
    GROUP BY c.post_id
  ),
  reaction_rows AS (
    SELECT
      l.post_id,
      COALESCE(NULLIF(l.emoji, ''), '❤️') AS emoji,
      COUNT(*)::bigint AS cnt
    FROM post_likes l
    WHERE l.post_id IN (SELECT id FROM page_ids)
    GROUP BY l.post_id, COALESCE(NULLIF(l.emoji, ''), '❤️')
  ),
  reaction_agg AS (
    SELECT
      post_id,
      COALESCE(SUM(cnt), 0)::bigint AS likes_count,
      COALESCE(
        jsonb_agg(jsonb_build_object('emoji', emoji, 'count', cnt) ORDER BY cnt DESC),
        '[]'::jsonb
      ) AS reaction_summary
    FROM reaction_rows
    GROUP BY post_id
  ),
  my_reactions AS (
    SELECT
      l.post_id,
      COALESCE(NULLIF(l.emoji, ''), '❤️') AS emoji
    FROM post_likes l
    WHERE l.user_id = p_viewer
      AND l.post_id IN (SELECT id FROM page_ids)
  ),
  shared AS (
    SELECT
      sp.id,
      sp.user_id,
      sp.content,
      sp.mood,
      sp.poll,
      sp.post_type,
      sp.badge_data,
      sp.workout_data,
      sp.created_at,
      CASE
        WHEN sp.images IS NULL THEN false
        WHEN pg_column_size(sp.images) IS NULL THEN false
        WHEN pg_column_size(sp.images) > 8 THEN true
        ELSE false
      END AS has_images
    FROM posts sp
    WHERE sp.id IN (SELECT DISTINCT shared_from FROM page WHERE shared_from IS NOT NULL)
  ),
  authors AS (
    SELECT pr.id, pr.name, pr.username, pr.avatar, pr.stats
    FROM profiles pr
    WHERE pr.id IN (
      SELECT user_id FROM page
      UNION
      SELECT user_id FROM shared
    )
  )
  SELECT
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'user_id', p.user_id,
            'content', p.content,
            'images', '[]'::jsonb,
            'images_omitted', COALESCE(p.has_images, false)
              OR COALESCE(p.post_type, '') IN ('image', 'mixed'),
            'mood', to_jsonb(p.mood),
            'poll', to_jsonb(p.poll),
            'post_type', p.post_type,
            'badge_data', to_jsonb(p.badge_data),
            'workout_data', to_jsonb(p.workout_data),
            'shared_from', p.shared_from,
            'created_at', p.created_at,
            'updated_at', p.updated_at,
            'comments_count', COALESCE(cc.cnt, 0),
            'likes_count', COALESCE(ra.likes_count, 0),
            'my_reaction', mr.emoji,
            'reaction_summary', COALESCE(ra.reaction_summary, '[]'::jsonb),
            'author', jsonb_build_object(
              'id', a.id,
              'name', a.name,
              'username', a.username,
              'avatar', a.avatar,
              'stats', to_jsonb(a.stats)
            ),
            'shared_post', CASE
              WHEN sp.id IS NULL THEN NULL
              ELSE jsonb_build_object(
                'id', sp.id,
                'user_id', sp.user_id,
                'content', sp.content,
                'images', '[]'::jsonb,
                'images_omitted', COALESCE(sp.has_images, false)
                  OR COALESCE(sp.post_type, '') IN ('image', 'mixed'),
                'mood', to_jsonb(sp.mood),
                'poll', to_jsonb(sp.poll),
                'post_type', sp.post_type,
                'badge_data', to_jsonb(sp.badge_data),
                'workout_data', to_jsonb(sp.workout_data),
                'created_at', sp.created_at,
                'author', jsonb_build_object(
                  'id', sa.id,
                  'name', sa.name,
                  'username', sa.username,
                  'avatar', sa.avatar,
                  'stats', to_jsonb(sa.stats)
                )
              )
            END
          )
          ORDER BY p.created_at DESC
        )
        FROM page p
        LEFT JOIN comment_counts cc ON cc.post_id = p.id
        LEFT JOIN reaction_agg ra ON ra.post_id = p.id
        LEFT JOIN my_reactions mr ON mr.post_id = p.id
        LEFT JOIN authors a ON a.id = p.user_id
        LEFT JOIN shared sp ON sp.id = p.shared_from
        LEFT JOIN authors sa ON sa.id = sp.user_id
      ),
      '[]'::jsonb
    ),
    (SELECT COUNT(*) > v_limit FROM ranked)
  INTO v_posts, v_has_more;

  RETURN jsonb_build_object(
    'posts', COALESCE(v_posts, '[]'::jsonb),
    'hasMore', COALESCE(v_has_more, false),
    'nextCursor', CASE
      WHEN v_posts IS NOT NULL AND jsonb_array_length(v_posts) > 0
        THEN v_posts -> (jsonb_array_length(v_posts) - 1) ->> 'created_at'
      ELSE NULL
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_social_feed_page(uuid, timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_social_feed_page(uuid, timestamptz, int) TO authenticated;
