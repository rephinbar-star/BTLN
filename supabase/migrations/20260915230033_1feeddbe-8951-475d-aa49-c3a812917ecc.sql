ALTER TABLE public.group_reads
  ADD COLUMN IF NOT EXISTS access_source text NOT NULL DEFAULT 'free';

ALTER TABLE public.group_reads
  DROP CONSTRAINT IF EXISTS group_reads_access_source_check;
ALTER TABLE public.group_reads
  ADD CONSTRAINT group_reads_access_source_check
  CHECK (access_source IN ('free','subscription','one_time','awaiting_payment'));

CREATE TABLE IF NOT EXISTS public.group_read_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_read_id uuid NOT NULL REFERENCES public.group_reads(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_read_id)
);

GRANT SELECT ON public.group_read_unlocks TO authenticated;
GRANT ALL ON public.group_read_unlocks TO service_role;
ALTER TABLE public.group_read_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own group read unlocks" ON public.group_read_unlocks;
CREATE POLICY "own group read unlocks"
  ON public.group_read_unlocks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only full-report plans (monthly / annual) grant full reports and unlimited
-- group reads. decode_monthly is a Quick Take-only plan and must not.
CREATE OR REPLACE FUNCTION public.user_has_full_plan(p_user_id uuid)
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
         AND tier IN ('monthly','annual')
         AND status IN ('active','trialing','past_due')
         AND (current_period_end IS NULL OR current_period_end > now())
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_full_plan(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_full_plan(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_has_full_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_full_plan(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.user_has_paid_access(p_user_id uuid, p_analysis_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
          AND tier IN ('monthly','annual')
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
$$;

-- Free allowance counts only reads actually taken from the free allowance.
CREATE OR REPLACE FUNCTION public.count_group_reads_since_cutoff(p_session_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*), 0)::integer
    FROM public.group_reads g
   WHERE g.created_at >= timestamptz '2026-09-15 22:00:00+00'
     AND g.status <> 'failed'
     AND g.access_source = 'free'
     AND (
       (auth.uid() IS NOT NULL AND p_user_id IS NOT NULL AND auth.uid() = p_user_id AND g.user_id = p_user_id)
       OR (p_session_id IS NOT NULL AND g.session_id = p_session_id)
     );
$$;

CREATE OR REPLACE FUNCTION public.has_group_read_unlock(p_group_read_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_read_unlocks
     WHERE group_read_id = p_group_read_id
       AND user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_group_read_unlock(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_group_read_unlock(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_group_read_unlock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_group_read_unlock(uuid) TO service_role;