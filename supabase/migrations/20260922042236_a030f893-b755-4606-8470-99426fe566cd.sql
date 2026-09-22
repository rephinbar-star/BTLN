-- 1. Least-privilege: revoke anon EXECUTE on functions that require auth.uid().
-- Root cause: project-level ALTER DEFAULT PRIVILEGES grants EXECUTE on new
-- functions to anon/authenticated/service_role, so an explicit
-- "GRANT EXECUTE TO authenticated" never excluded anon.
REVOKE EXECUTE ON FUNCTION public.get_coaching_feedback_context(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_coaching_personalization() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_my_ai_feedback() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_ai_feedback_aggregate(integer) FROM anon;

REVOKE EXECUTE ON FUNCTION public.journey_activate(boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.journey_opt_out() FROM anon;
REVOKE EXECUTE ON FUNCTION public.journey_export() FROM anon;
REVOKE EXECUTE ON FUNCTION public.journey_delete_all() FROM anon;
REVOKE EXECUTE ON FUNCTION public.journey_confirm_identity(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.journey_mark_absent(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.journey_set_source_excluded(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.journey_auto_include() FROM anon;
REVOKE EXECUTE ON FUNCTION public.journey_write_summary(uuid, text, uuid, jsonb, uuid[], jsonb, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_entitlement(text) FROM anon;

-- 2. Server-authoritative budget for the public screenshot-reading endpoint.
CREATE TABLE IF NOT EXISTS public.extraction_budget (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  image_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_start)
);

GRANT ALL ON public.extraction_budget TO service_role;
ALTER TABLE public.extraction_budget ENABLE ROW LEVEL SECURITY;
-- No policies: unreachable through the Data API by anon/authenticated by design.

CREATE OR REPLACE FUNCTION public.claim_extraction_budget(
  p_bucket text,
  p_images integer,
  p_max_requests integer,
  p_max_images integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := date_trunc('hour', now());
  v_requests integer;
  v_images integer;
BEGIN
  IF p_bucket IS NULL OR length(p_bucket) = 0 OR p_images < 1 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_request');
  END IF;

  INSERT INTO public.extraction_budget (bucket_key, window_start, request_count, image_count)
  VALUES (p_bucket, v_window, 1, p_images)
  ON CONFLICT (bucket_key, window_start) DO UPDATE
    SET request_count = public.extraction_budget.request_count + 1,
        image_count = public.extraction_budget.image_count + EXCLUDED.image_count,
        updated_at = now()
  RETURNING request_count, image_count INTO v_requests, v_images;

  DELETE FROM public.extraction_budget WHERE window_start < now() - interval '2 days';

  IF v_requests > p_max_requests THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'too_many_requests', 'requests', v_requests);
  END IF;
  IF v_images > p_max_images THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'too_many_images', 'images', v_images);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'requests', v_requests, 'images', v_images);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_extraction_budget(text, integer, integer, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.claim_extraction_budget(text, integer, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_extraction_budget(text, integer, integer, integer) TO service_role;