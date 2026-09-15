-- Only a signed-in caller can ask about their own subscription state.
CREATE OR REPLACE FUNCTION public.user_has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR auth.uid() IS NULL OR auth.uid() <> p_user_id THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_subscriptions
       WHERE user_id = p_user_id
         AND status IN ('active','trialing','past_due')
         AND (current_period_end IS NULL OR current_period_end > now())
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_active_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_recipient_perspective(text, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_recipient_perspective(text, integer, text) TO authenticated;