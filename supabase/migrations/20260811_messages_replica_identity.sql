-- Ensure chat delivery UPDATE events reach Realtime filters (from_user_id / to_user_id)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
