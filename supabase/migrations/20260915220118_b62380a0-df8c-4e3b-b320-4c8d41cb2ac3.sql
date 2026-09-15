CREATE TABLE public.recipient_perspectives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_link_id uuid NOT NULL REFERENCES public.group_share_links(id) ON DELETE CASCADE,
  participant_index integer NOT NULL,
  participant_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recipient_perspectives_unique UNIQUE (user_id, share_link_id, participant_index)
);

GRANT SELECT ON public.recipient_perspectives TO authenticated;
GRANT ALL ON public.recipient_perspectives TO service_role;

ALTER TABLE public.recipient_perspectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own saved perspectives"
  ON public.recipient_perspectives FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_recipient_perspectives_updated_at
  BEFORE UPDATE ON public.recipient_perspectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Saving a perspective is self-reported only. It never grants access to the
-- private group read, never transfers ownership, and always re-checks that the
-- share link is still live (fails closed once the owner revokes).
CREATE OR REPLACE FUNCTION public.save_recipient_perspective(
  p_token_hash text,
  p_participant_index integer,
  p_participant_label text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_share uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;
  IF p_token_hash IS NULL OR length(p_token_hash) < 32 THEN
    RAISE EXCEPTION 'invalid link';
  END IF;
  IF p_participant_index IS NULL OR p_participant_index < 0 OR p_participant_index > 30 THEN
    RAISE EXCEPTION 'invalid participant';
  END IF;

  SELECT s.id INTO v_share
    FROM public.group_share_links s
   WHERE s.token_hash = p_token_hash
     AND s.revoked_at IS NULL
   LIMIT 1;

  IF v_share IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.recipient_perspectives (user_id, share_link_id, participant_index, participant_label)
  VALUES (auth.uid(), v_share, p_participant_index, NULLIF(trim(coalesce(p_participant_label, '')), ''))
  ON CONFLICT (user_id, share_link_id, participant_index)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Entitlement helper for Group Read generation: an active subscription of any
-- tier. Mirrors the rule already used by user_has_paid_access.
CREATE OR REPLACE FUNCTION public.user_has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN p_user_id IS NULL THEN false ELSE EXISTS (
    SELECT 1 FROM public.user_subscriptions
     WHERE user_id = p_user_id
       AND status IN ('active','trialing','past_due')
       AND (current_period_end IS NULL OR current_period_end > now())
  ) END;
$$;

-- Free-preview meter for Group Read. Only reads created on or after the rule
-- cutoff count, so every existing user keeps their free read.
CREATE OR REPLACE FUNCTION public.count_group_reads_since_cutoff(p_session_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*), 0)::integer
    FROM public.group_reads g
   WHERE g.created_at >= timestamptz '2026-09-15 00:00:00+00'
     AND g.status <> 'failed'
     AND (
       (auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() = p_user_id AND g.user_id = p_user_id)
       OR (p_session_id IS NOT NULL AND g.session_id = p_session_id)
     );
$$;