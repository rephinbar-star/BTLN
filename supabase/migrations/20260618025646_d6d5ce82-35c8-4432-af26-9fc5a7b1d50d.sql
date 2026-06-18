
-- Tighten SELECT policy: drop broad anonymous unclaimed read access
DROP POLICY IF EXISTS "Read own or unclaimed analyses" ON public.analyses;

CREATE POLICY "Read own analyses"
ON public.analyses
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Allow the anonymous creator (session_id match) to update their own row
-- so the error handlers in InputSection can mark a failed analysis.
DROP POLICY IF EXISTS "Users can update own analyses" ON public.analyses;

CREATE POLICY "Update own analyses"
ON public.analyses
FOR UPDATE
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- RPC: fetch an analysis if caller is owner OR provides matching session_id
CREATE OR REPLACE FUNCTION public.get_analysis_for_session(
  p_id uuid,
  p_session_id uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  result_json jsonb,
  context_data jsonb,
  message_count integer,
  error_message text,
  couple_type_id integer,
  relationship_type text,
  is_paid boolean,
  user_id uuid,
  session_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.status, a.result_json, a.context_data, a.message_count,
         a.error_message, a.couple_type_id, a.relationship_type,
         a.is_paid, a.user_id, a.session_id
    FROM public.analyses a
   WHERE a.id = p_id
     AND (
       (auth.uid() IS NOT NULL AND a.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND a.session_id = p_session_id)
     )
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_analysis_for_session(uuid, uuid) TO anon, authenticated;

-- RPC: anonymous creator (session match) or owner can mark analysis failed
CREATE OR REPLACE FUNCTION public.mark_analysis_failed(
  p_id uuid,
  p_session_id uuid,
  p_error_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.analyses
     SET status = 'failed',
         error_message = p_error_message,
         completed_at = now()
   WHERE id = p_id
     AND (
       (auth.uid() IS NOT NULL AND user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND session_id = p_session_id)
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_analysis_failed(uuid, uuid, text) TO anon, authenticated;
