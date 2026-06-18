
-- ============ email_captures: lock down and provide RPC ============
DROP POLICY IF EXISTS "Insert email captures as self or anonymous" ON public.email_captures;

CREATE POLICY "Insert email captures as owner"
ON public.email_captures
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    analysis_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.analyses a
      WHERE a.id = analysis_id AND a.user_id = auth.uid()
    )
  )
);

CREATE OR REPLACE FUNCTION public.capture_email(
  p_email text,
  p_analysis_id uuid,
  p_source text,
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_session uuid;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'email required';
  END IF;

  IF p_analysis_id IS NOT NULL THEN
    SELECT user_id, session_id INTO v_owner, v_session
      FROM public.analyses WHERE id = p_analysis_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'analysis not found';
    END IF;
    IF NOT (
      (auth.uid() IS NOT NULL AND v_owner = auth.uid())
      OR (p_session_id IS NOT NULL AND v_session = p_session_id)
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  INSERT INTO public.email_captures(email, analysis_id, source, user_id)
  VALUES (p_email, p_analysis_id, COALESCE(p_source, 'feedback_modal'), auth.uid())
  ON CONFLICT (email) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.capture_email(text, uuid, text, uuid) TO anon, authenticated;

-- ============ share_clicks: lock down and provide RPC ============
DROP POLICY IF EXISTS "Insert share clicks with platform" ON public.share_clicks;

CREATE OR REPLACE FUNCTION public.record_share_click(
  p_analysis_id uuid,
  p_platform text,
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_session uuid;
BEGIN
  IF p_platform IS NULL OR length(trim(p_platform)) = 0 THEN
    RAISE EXCEPTION 'platform required';
  END IF;

  IF p_analysis_id IS NOT NULL THEN
    SELECT user_id, session_id INTO v_owner, v_session
      FROM public.analyses WHERE id = p_analysis_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'analysis not found';
    END IF;
    IF NOT (
      (auth.uid() IS NOT NULL AND v_owner = auth.uid())
      OR (p_session_id IS NOT NULL AND v_session = p_session_id)
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  INSERT INTO public.share_clicks(analysis_id, platform)
  VALUES (p_analysis_id, p_platform);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_share_click(uuid, text, uuid) TO anon, authenticated;

-- ============ events: add user_id, lock down, provide RPC ============
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Insert events with session" ON public.events;

CREATE OR REPLACE FUNCTION public.log_event(
  p_session_id uuid,
  p_event_name text,
  p_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_id IS NULL OR p_event_name IS NULL OR length(trim(p_event_name)) = 0 THEN
    RAISE EXCEPTION 'session_id and event_name required';
  END IF;

  INSERT INTO public.events(session_id, event_name, metadata, user_id)
  VALUES (p_session_id, p_event_name, p_metadata, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_event(uuid, text, jsonb) TO anon, authenticated;
