-- Story favorites (highlights) — media is snapshotted so it survives 24h expiry

CREATE TABLE IF NOT EXISTS story_favorite_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS story_favorite_albums_user_id_idx
  ON story_favorite_albums(user_id);

CREATE TABLE IF NOT EXISTS story_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES story_favorite_albums(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  original_story_id uuid,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url text NOT NULL,
  caption text DEFAULT '',
  author_id uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS story_favorites_album_id_idx ON story_favorites(album_id);
CREATE INDEX IF NOT EXISTS story_favorites_user_id_idx ON story_favorites(user_id);
