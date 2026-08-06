-- Nested comment replies (Facebook-style threads)
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS post_comments_parent_id_idx
  ON post_comments(parent_id)
  WHERE parent_id IS NOT NULL;

COMMENT ON COLUMN post_comments.parent_id IS 'If set, this comment replies to another comment on the same post';
