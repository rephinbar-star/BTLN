CREATE TABLE public.decode_unlocks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 decode_id uuid NOT NULL REFERENCES public.decodes(id) ON DELETE CASCADE,
 amount_cents integer NOT NULL DEFAULT 499,
 stripe_payment_intent_id text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, decode_id)
);
GRANT SELECT ON public.decode_unlocks TO authenticated;
GRANT ALL ON public.decode_unlocks TO service_role;
ALTER TABLE public.decode_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read single Quick Take unlocks" ON public.decode_unlocks FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.decode_access_allowed(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.decodes d WHERE d.id=p_id AND (
 EXISTS (SELECT 1 FROM public.user_subscriptions s WHERE s.user_id=d.user_id AND s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
 OR EXISTS (SELECT 1 FROM public.decode_unlocks u WHERE u.decode_id=d.id AND u.user_id=d.user_id)
 OR NOT EXISTS (SELECT 1 FROM public.decodes earlier WHERE earlier.status='complete' AND (earlier.created_at,earlier.id)<(d.created_at,d.id)
 AND ((d.user_id IS NOT NULL AND earlier.user_id=d.user_id) OR (earlier.session_id=d.session_id AND earlier.user_id IS NULL))
 AND NOT EXISTS (SELECT 1 FROM public.evaluation_artifacts e WHERE e.source_id=earlier.id AND e.source_kind='quick_take'))
 ));
$$;
REVOKE ALL ON FUNCTION public.decode_access_allowed(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.decode_access_allowed(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_decode_for_session(p_id uuid, p_session_id uuid)
RETURNS TABLE(id uuid,status text,result_json jsonb,source text,error_message text,relationship_id uuid,user_id uuid,session_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT d.id,d.status,
 CASE WHEN public.decode_access_allowed(d.id) THEN COALESCE(d.result_json,'{}'::jsonb) || jsonb_build_object('_access_locked',false)
 ELSE (COALESCE(d.result_json,'{}'::jsonb) - 'reply_options') || jsonb_build_object('reply_options','[]'::jsonb,'_access_locked',true) END,
 d.source,d.error_message,d.relationship_id,d.user_id,d.session_id
 FROM public.decodes d WHERE d.id=p_id AND ((auth.uid() IS NOT NULL AND d.user_id=auth.uid()) OR (d.user_id IS NULL AND d.session_id=p_session_id))
 AND NOT EXISTS (SELECT 1 FROM public.evaluation_artifacts e WHERE e.source_id=d.id AND e.source_kind='quick_take')
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_decode_for_session(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_decode_for_session(uuid,uuid) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.claim_decode_for_session(p_id uuid,p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 UPDATE public.decodes SET user_id=auth.uid() WHERE id=p_id AND session_id=p_session_id AND user_id IS NULL
 AND NOT EXISTS (SELECT 1 FROM public.evaluation_artifacts e WHERE e.source_id=p_id AND e.source_kind='quick_take');
 RETURN EXISTS (SELECT 1 FROM public.decodes WHERE id=p_id AND user_id=auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.claim_decode_for_session(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_decode_for_session(uuid,uuid) TO authenticated;

REVOKE SELECT ON public.decodes FROM anon,authenticated;
GRANT SELECT(id,user_id,session_id,source,status,error_message,relationship_id,created_at) ON public.decodes TO authenticated;
COMMENT ON COLUMN public.decodes.result_json IS 'Read through get_decode_for_session; protected reply options withheld until free or paid access is verified.';