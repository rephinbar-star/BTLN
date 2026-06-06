CREATE OR REPLACE FUNCTION public.user_has_paid_access(p_user_id uuid, p_analysis_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN p_user_id IS NULL OR p_analysis_id IS NULL THEN false
      WHEN EXISTS (
        SELECT 1 FROM public.analyses
        WHERE id = p_analysis_id
          AND user_id = p_user_id
          AND is_paid = true
      ) THEN true
      WHEN EXISTS (
        SELECT 1 FROM public.user_subscriptions
        WHERE user_id = p_user_id
          AND status IN ('active','trialing','past_due')
          AND (current_period_end IS NULL OR current_period_end > now())
      ) THEN true
      WHEN EXISTS (
        SELECT 1 FROM public.one_time_unlocks
        WHERE user_id = p_user_id
          AND analysis_id = p_analysis_id
      ) THEN true
      ELSE false
    END;
$function$;

GRANT EXECUTE ON FUNCTION public.user_has_paid_access(uuid, uuid) TO anon, authenticated;