CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  environment text NOT NULL,
  event_id text,
  event_type text NOT NULL,
  checkout_session_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  analysis_id uuid,
  amount_cents integer,
  status text NOT NULL DEFAULT 'received',
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_events_user_id_idx ON public.webhook_events(user_id, created_at DESC);
CREATE INDEX webhook_events_session_idx ON public.webhook_events(checkout_session_id);
CREATE INDEX webhook_events_event_id_idx ON public.webhook_events(event_id);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own webhook events"
  ON public.webhook_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);