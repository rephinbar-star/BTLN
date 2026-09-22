ALTER TABLE public.journey_profiles
  ADD COLUMN IF NOT EXISTS auto_include_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activation_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.journey_relationships
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'pair';
ALTER TABLE public.journey_relationships
  DROP CONSTRAINT IF EXISTS journey_relationships_scope_check;
ALTER TABLE public.journey_relationships
  ADD CONSTRAINT journey_relationships_scope_check CHECK (scope IN ('pair','group'));
ALTER TABLE public.journey_relationships
  DROP CONSTRAINT IF EXISTS journey_relationships_kind_check;
ALTER TABLE public.journey_relationships
  ADD CONSTRAINT journey_relationships_kind_check
  CHECK (kind IN ('romantic','friend','family','work_group','unspecified'));

ALTER TABLE public.journey_sources
  ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.journey_sources
  DROP CONSTRAINT IF EXISTS journey_sources_identity_status_check;
ALTER TABLE public.journey_sources
  ADD CONSTRAINT journey_sources_identity_status_check
  CHECK (identity_status IN ('confirmed','pending','absent'));

UPDATE public.journey_sources
   SET identity_status = 'confirmed'
 WHERE subject_participant IS NOT NULL
   AND char_length(trim(subject_participant)) > 0
   AND identity_status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS journey_sources_canonical_idx
  ON public.journey_sources(user_id, source_kind, source_id);

-- Validation: ownership, activation consent, identity semantics.
CREATE OR REPLACE FUNCTION public.journey_validate_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_rel_owner uuid;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'journey sources may only be linked by their owner';
  END IF;
  SELECT user_id INTO v_rel_owner FROM public.journey_relationships WHERE id = NEW.relationship_id;
  IF v_rel_owner IS NULL OR v_rel_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'relationship not owned by caller';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.journey_profiles p
                  WHERE p.user_id = NEW.user_id AND p.opted_in_at IS NOT NULL) THEN
    RAISE EXCEPTION 'journey opt-in required';
  END IF;
  IF NEW.source_kind = 'quick_take' THEN
    SELECT user_id INTO v_owner FROM public.decodes WHERE id = NEW.source_id;
  ELSIF NEW.source_kind = 'deep_read' THEN
    SELECT user_id INTO v_owner FROM public.analyses WHERE id = NEW.source_id;
  ELSIF NEW.source_kind = 'group_read' THEN
    SELECT user_id INTO v_owner FROM public.group_reads WHERE id = NEW.source_id;
  ELSIF NEW.source_kind = 'group_roast' THEN
    SELECT user_id INTO v_owner FROM public.group_roasts WHERE id = NEW.source_id AND status = 'complete';
  END IF;
  IF v_owner IS NULL OR v_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'source not found or not owned by caller';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.identity_status = 'absent' THEN
    RAISE EXCEPTION 'a conversation you are not part of cannot be included';
  END IF;
  IF NEW.identity_status = 'confirmed'
     AND (NEW.subject_participant IS NULL OR char_length(trim(NEW.subject_participant)) = 0) THEN
    RAISE EXCEPTION 'confirm which participant you are before this conversation contributes';
  END IF;
  IF NEW.identity_status <> 'confirmed' THEN
    NEW.subject_participant := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journey_sources_validate ON public.journey_sources;
CREATE TRIGGER journey_sources_validate
  BEFORE INSERT OR UPDATE OF source_id, source_kind, relationship_id, user_id, identity_status, subject_participant
  ON public.journey_sources
  FOR EACH ROW EXECUTE FUNCTION public.journey_validate_source();

-- Activation consent (supersedes the old bare opt-in flag, never silently widened).
CREATE OR REPLACE FUNCTION public.journey_activate(p_auto_include boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;
  INSERT INTO public.journey_profiles (user_id, opted_in_at, auto_include_enabled, activation_consent_at, consent_version)
  VALUES (auth.uid(), now(), coalesce(p_auto_include, false), now(), 2)
  ON CONFLICT (user_id) DO UPDATE
    SET opted_in_at = now(),
        auto_include_enabled = coalesce(p_auto_include, false),
        activation_consent_at = now(),
        consent_version = 2;
END;
$$;

-- Participants detected in a report the caller owns. Never returns message text.
CREATE OR REPLACE FUNCTION public.journey_source_participants(p_source_kind text, p_source_id uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_out text[] := '{}';
  v_ctx jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;
  IF p_source_kind = 'deep_read' THEN
    SELECT context_data INTO v_ctx FROM public.analyses WHERE id = p_source_id AND user_id = v_uid;
    IF v_ctx IS NOT NULL THEN
      v_out := array_remove(ARRAY[nullif(trim(v_ctx->>'name1'), ''), nullif(trim(v_ctx->>'name2'), '')], NULL);
    END IF;
  ELSIF p_source_kind = 'group_roast' THEN
    SELECT coalesce(
             (SELECT array_agg(value) FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(participant_labels) = 'array' THEN participant_labels ELSE '[]'::jsonb END) AS value),
             '{}')
      INTO v_out
      FROM public.group_roasts WHERE id = p_source_id AND user_id = v_uid;
  END IF;
  RETURN coalesce(v_out, '{}');
END;
$$;

CREATE OR REPLACE FUNCTION public.journey_confirm_identity(p_source_id uuid, p_participant text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;
  IF p_participant IS NULL OR char_length(trim(p_participant)) = 0 THEN
    RAISE EXCEPTION 'choose which participant is you';
  END IF;
  UPDATE public.journey_sources
     SET subject_participant = trim(p_participant),
         identity_status = 'confirmed'
   WHERE id = p_source_id AND user_id = v_uid;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.journey_mark_absent(p_source_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;
  UPDATE public.journey_sources
     SET identity_status = 'absent',
         subject_participant = NULL,
         excluded_at = coalesce(excluded_at, now())
   WHERE id = p_source_id AND user_id = v_uid;
  RETURN FOUND;
END;
$$;

-- Automatic inclusion of eligible owned reports. Each row still waits for identity
-- confirmation before it can contribute anything.
CREATE OR REPLACE FUNCTION public.journey_auto_include()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.journey_profiles%ROWTYPE;
  v_added integer := 0;
  r record;
  v_rel uuid;
  v_scope text;
  v_label text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;
  SELECT * INTO v_profile FROM public.journey_profiles WHERE user_id = v_uid;
  IF v_profile.user_id IS NULL OR v_profile.opted_in_at IS NULL OR NOT v_profile.auto_include_enabled THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT 'quick_take'::text AS kind, id, created_at FROM public.decodes
      WHERE user_id = v_uid AND status = 'complete'
    UNION ALL
    SELECT 'deep_read', id, created_at FROM public.analyses
      WHERE user_id = v_uid AND status = 'complete'
    UNION ALL
    SELECT 'group_read', id, created_at FROM public.group_reads
      WHERE user_id = v_uid AND status = 'complete'
    UNION ALL
    SELECT 'group_roast', id, created_at FROM public.group_roasts
      WHERE user_id = v_uid AND status = 'complete'
    ORDER BY created_at DESC
    LIMIT 200
  LOOP
    IF EXISTS (SELECT 1 FROM public.journey_sources s
                WHERE s.user_id = v_uid AND s.source_kind = r.kind AND s.source_id = r.id) THEN
      CONTINUE;
    END IF;
    v_scope := CASE WHEN r.kind IN ('group_read','group_roast') THEN 'group' ELSE 'pair' END;
    v_label := CASE r.kind
                 WHEN 'quick_take' THEN 'Quick Take'
                 WHEN 'deep_read' THEN 'Deep Read'
                 WHEN 'group_read' THEN 'Group Read'
                 ELSE 'Group Roast' END
               || ' · ' || to_char(r.created_at, 'DD Mon YYYY');
    INSERT INTO public.journey_relationships (user_id, kind, label, scope)
    VALUES (v_uid, 'unspecified', v_label, v_scope)
    RETURNING id INTO v_rel;

    INSERT INTO public.journey_sources (user_id, relationship_id, source_kind, source_id, identity_status)
    VALUES (v_uid, v_rel, r.kind, r.id, 'pending');
    v_added := v_added + 1;
  END LOOP;

  RETURN v_added;
END;
$$;

REVOKE ALL ON FUNCTION public.journey_validate_source() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.journey_validate_source() TO service_role;
GRANT EXECUTE ON FUNCTION public.journey_activate(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.journey_source_participants(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.journey_confirm_identity(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.journey_mark_absent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.journey_auto_include() TO authenticated, service_role;