CREATE OR REPLACE FUNCTION public.claim_analysis(p_analysis_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated boolean := false;
BEGIN
  IF auth.uid() IS NULL OR p_analysis_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.analyses
     SET user_id = auth.uid()
   WHERE id = p_analysis_id
     AND user_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_analysis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_analysis(uuid) TO service_role;