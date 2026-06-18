-- Remove tables from realtime publication since the app does not use Realtime subscriptions.
-- This eliminates the attack surface described in REALTIME_MISSING_CHANNEL_AUTHORIZATION.
ALTER PUBLICATION supabase_realtime DROP TABLE public.one_time_unlocks;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_subscriptions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.analyses;
