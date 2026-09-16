CREATE OR REPLACE FUNCTION public.claim_webhook_event(p_event_id text, p_event_type text, p_environment text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  IF p_event_id IS NULL OR char_length(p_event_id) < 3 THEN
    RETURN false;
  END IF;

  INSERT INTO public.webhook_events (
    provider, environment, event_id, event_type, status, changes, payload_summary
  ) VALUES (
    'stripe', p_environment, p_event_id, p_event_type, 'processing', '{}'::jsonb, '{}'::jsonb
  )
  ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN
    RETURN true;
  END IF;

  UPDATE public.webhook_events
  SET status = 'processing', error_message = NULL, created_at = now()
  WHERE event_id = p_event_id
    AND (
      status = 'error'
      OR (status = 'processing' AND created_at < now() - interval '10 minutes')
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_event(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_event(text, text, text) TO service_role;