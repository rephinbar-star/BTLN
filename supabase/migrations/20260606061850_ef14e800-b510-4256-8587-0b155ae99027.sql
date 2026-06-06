DROP INDEX IF EXISTS public.user_subscriptions_stripe_subscription_id_key;

CREATE UNIQUE INDEX user_subscriptions_stripe_subscription_id_key
  ON public.user_subscriptions(stripe_subscription_id);

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check
  CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'cancelled', 'expired', 'trial', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'));

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_tier_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_tier_check
  CHECK (tier IN ('monthly', 'annual', 'lifetime', 'unknown'));

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_status_idx
  ON public.user_subscriptions(user_id, status);