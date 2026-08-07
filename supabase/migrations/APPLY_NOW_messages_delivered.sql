-- ============================================================
-- FIX PALOMITAS DE CHAT — pegar TODO en Supabase → SQL Editor → Run
-- ============================================================

-- 1) Columna que faltaba (sin ella TODOS los UPDATE de entregado/leído fallan)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 2) Mensajes ya leídos también cuentan como entregados
UPDATE public.messages
SET delivered = true,
    delivered_at = COALESCE(delivered_at, created_at)
WHERE read = true AND delivered = false;

-- 3) Para que Realtime notifique UPDATEs filtrados por from/to
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Verificación rápida (debe devolver delivered / delivered_at / read):
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'messages'
-- order by column_name;
