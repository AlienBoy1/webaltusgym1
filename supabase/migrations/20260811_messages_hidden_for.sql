-- Per-user "delete for me" + soft-delete support for chat messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS hidden_for uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS messages_hidden_for_gin
  ON public.messages USING gin (hidden_for);
