
-- Block direct inserts: all writes must go through SECURITY DEFINER RPCs
CREATE POLICY "Block direct inserts on paywall_intents"
  ON public.paywall_intents
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Block direct inserts on survey_responses"
  ON public.survey_responses
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- share_clicks has no user_id; deny all direct client access. Writes go through record_share_click RPC.
CREATE POLICY "Block direct inserts on share_clicks"
  ON public.share_clicks
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Block direct reads on share_clicks"
  ON public.share_clicks
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (false);
