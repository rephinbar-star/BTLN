-- Ensure stripe_subscription_id is unique so webhook upserts work correctly.
-- Existing rows (if any duplicates) would block this; user_subscriptions is currently empty.
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_stripe_subscription_id_key
  ON public.user_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_status_idx
  ON public.user_subscriptions(user_id, status);