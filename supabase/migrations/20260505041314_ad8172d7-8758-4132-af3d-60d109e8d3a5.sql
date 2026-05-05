-- Add user_id to email_captures
ALTER TABLE public.email_captures
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- New claim function with explicit user_id and 30-day window
CREATE OR REPLACE FUNCTION public.claim_anonymous_analyses(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL THEN
    RETURN 0;
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.analyses
     SET user_id = p_user_id
   WHERE session_id = p_session_id
     AND user_id IS NULL
     AND created_at > now() - interval '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;