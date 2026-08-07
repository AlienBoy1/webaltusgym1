-- Delivery ticks require these columns (read already exists in prod).
-- Without delivered, every UPDATE that also sets delivered:true fails and receipts never advance.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Backfill: anything already read was at least delivered
UPDATE public.messages
SET delivered = true,
    delivered_at = COALESCE(delivered_at, created_at)
WHERE read = true AND delivered = false;

-- Realtime filters on from_user_id / to_user_id need FULL identity for UPDATE events
ALTER TABLE public.messages REPLICA IDENTITY FULL;
