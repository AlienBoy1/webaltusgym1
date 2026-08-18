-- Pegar TODO en el SQL Editor de la cuenta NUEVA de Supabase → Run
-- Idempotente: se puede volver a ejecutar.

-- 1) Chat: entregado / leído / ocultar para mí
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deliavered boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS hidden_for uuid[] NOT NULL DEFAULT '{}';

UPDATE public.messages
SET delivered = true,
    delivered_at = COALESCE(delivered_at, created_at)
WHERE read = true AND delivered = false;

ALTER TABLE public.messages REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS messages_hidden_for_gin
  ON public.messages USING gin (hidden_for);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS preview text;

UPDATE public.messages
SET preview = left(content, 160)
WHERE preview IS NULL
  AND content IS NOT NULL
  AND content NOT LIKE '__QMSG__%'
  AND char_length(content) < 500;

-- 2) Storage público para fotos (deja de meter data URLs en Postgres)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  15728640,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'audio/webm',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS media_public_read ON storage.objects;
CREATE POLICY media_public_read
ON storage.objects
FOR SELECT
USING (bucket_id = 'media');

CREATE OR REPLACE FUNCTION public.list_profile_avatars(ids uuid[])
RETURNS TABLE(id uuid, name text, username text, avatar text, pending_storage boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.username,
    CASE
      WHEN p.avatar IS NULL THEN NULL
      WHEN p.avatar LIKE 'data:%' THEN NULL
      ELSE p.avatar
    END AS avatar,
    (p.avatar IS NOT NULL AND p.avatar LIKE 'data:%') AS pending_storage
  FROM public.profiles p
  WHERE p.id = ANY (ids);
$$;

REVOKE ALL ON FUNCTION public.list_profile_avatars(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_profile_avatars(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_profile_avatars(uuid[]) TO authenticated;
