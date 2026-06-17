
-- 1. analyses: tighten SELECT and INSERT
DROP POLICY IF EXISTS "Anyone can read analyses" ON public.analyses;
CREATE POLICY "Read own or unclaimed analyses"
  ON public.analyses FOR SELECT
  TO anon, authenticated
  USING (
    user_id IS NULL
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "Anyone can insert analyses" ON public.analyses;
CREATE POLICY "Insert analyses as self or anonymous"
  ON public.analyses FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );

-- 2. email_captures: tighten INSERT
DROP POLICY IF EXISTS "Anyone can insert email captures" ON public.email_captures;
CREATE POLICY "Insert email captures as self or anonymous"
  ON public.email_captures FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );

-- 3. events: require session_id, disallow always-true
DROP POLICY IF EXISTS "Anyone can insert events" ON public.events;
CREATE POLICY "Insert events with session"
  ON public.events FOR INSERT
  TO anon, authenticated
  WITH CHECK (session_id IS NOT NULL AND event_name IS NOT NULL);

-- 4. share_clicks
DROP POLICY IF EXISTS "Anyone can insert share clicks" ON public.share_clicks;
CREATE POLICY "Insert share clicks with platform"
  ON public.share_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (platform IS NOT NULL);

-- 5. storage: drop broad listing policy on couple_types bucket
--    (public file URLs still work; only the list/info API is restricted)
DROP POLICY IF EXISTS "Couple type illustrations are publicly readable" ON storage.objects;

-- 6. Lock down SECURITY DEFINER function execute privileges
REVOKE EXECUTE ON FUNCTION public.claim_analysis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_analysis(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_analyses_for_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_analyses_for_session(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_anonymous_analyses(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_analyses(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_has_paid_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_paid_access(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_couple_type_image_url(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_couple_type_image_url(integer, text, text) TO authenticated;

-- submit_feedback may be called from anonymous feedback flow
REVOKE EXECUTE ON FUNCTION public.submit_feedback(uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_feedback(uuid, integer, text, text) TO anon, authenticated;

-- Trigger-only helpers should not be callable via API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
