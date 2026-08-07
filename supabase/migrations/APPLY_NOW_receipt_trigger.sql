-- ============================================================
-- PASO 2 (después de delivered) — pegar en Supabase SQL Editor → Run
-- Notifica al remitente en vivo cuando cambia delivered/read
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_message_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.delivered IS DISTINCT FROM OLD.delivered
       OR NEW.read IS DISTINCT FROM OLD.read
     )
  THEN
    PERFORM realtime.send(
      jsonb_build_object(
        'to', NEW.from_user_id::text,
        'from', NEW.to_user_id::text,
        'delivered', COALESCE(NEW.delivered, false) OR COALESCE(NEW.read, false),
        'read', COALESCE(NEW.read, false),
        'messageIds', jsonb_build_array(NEW.id::text)
      ),
      'receipt',
      'receipts:' || NEW.from_user_id::text,
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_notify_receipt ON public.messages;
CREATE TRIGGER trg_messages_notify_receipt
  AFTER UPDATE OF delivered, read ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_receipt();
