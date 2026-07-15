-- Explicit deny policies on public.webhook_events to make write restrictions auditable.
-- service_role bypasses RLS and continues to write from the payments-webhook edge function.

REVOKE INSERT, UPDATE, DELETE ON public.webhook_events FROM anon, authenticated;

DROP POLICY IF EXISTS "Deny inserts from anon and authenticated" ON public.webhook_events;
CREATE POLICY "Deny inserts from anon and authenticated"
  ON public.webhook_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny updates from anon and authenticated" ON public.webhook_events;
CREATE POLICY "Deny updates from anon and authenticated"
  ON public.webhook_events
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny deletes from anon and authenticated" ON public.webhook_events;
CREATE POLICY "Deny deletes from anon and authenticated"
  ON public.webhook_events
  FOR DELETE
  TO anon, authenticated
  USING (false);
