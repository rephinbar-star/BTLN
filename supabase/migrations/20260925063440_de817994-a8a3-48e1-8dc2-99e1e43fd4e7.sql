ALTER TABLE public.journey_sources ADD COLUMN IF NOT EXISTS subject_participant_id text;

CREATE OR REPLACE FUNCTION public.journey_confirm_identity(p_source_id uuid, p_participant text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_source public.journey_sources%ROWTYPE;
  v_allowed text[];
  v_match text;
  v_id text := NULL;
  v_ctx jsonb;
  v_n1 text; v_n2 text;
  v_hits int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO v_source FROM public.journey_sources WHERE id=p_source_id AND user_id=v_uid;
  IF v_source.id IS NULL THEN RETURN false; END IF;

  IF v_source.source_kind = 'deep_read' THEN
    SELECT context_data INTO v_ctx FROM public.analyses WHERE id=v_source.source_id AND user_id=v_uid AND status='complete';
    IF v_ctx IS NULL THEN RAISE EXCEPTION 'choose a participant from this conversation'; END IF;
    v_n1 := nullif(trim(v_ctx->>'name1'),''); v_n2 := nullif(trim(v_ctx->>'name2'),'');
    IF p_participant IN ('id:p1','id:p2') THEN
      v_id := substr(p_participant,4);
      v_match := CASE WHEN v_id='p1' THEN v_n1 ELSE v_n2 END;
    ELSE
      v_hits := (CASE WHEN lower(v_n1)=lower(trim(p_participant)) THEN 1 ELSE 0 END)
              + (CASE WHEN lower(v_n2)=lower(trim(p_participant)) THEN 1 ELSE 0 END);
      IF v_hits > 1 THEN RAISE EXCEPTION 'both people share this name; choose first or second person'; END IF;
      IF lower(v_n1)=lower(trim(p_participant)) THEN v_id:='p1'; v_match:=v_n1;
      ELSIF lower(v_n2)=lower(trim(p_participant)) THEN v_id:='p2'; v_match:=v_n2; END IF;
    END IF;
    IF v_match IS NULL THEN RAISE EXCEPTION 'choose a participant from this conversation'; END IF;
  ELSE
    v_allowed := public.journey_source_participants(v_source.source_kind,v_source.source_id);
    SELECT candidate INTO v_match FROM unnest(v_allowed) candidate
      WHERE lower(trim(candidate))=lower(trim(p_participant)) LIMIT 1;
    IF v_match IS NULL THEN RAISE EXCEPTION 'choose a participant from this conversation'; END IF;
  END IF;

  UPDATE public.journey_sources
     SET subject_participant=v_match, subject_participant_id=v_id, identity_status='confirmed', excluded_at=NULL
   WHERE id=p_source_id AND user_id=v_uid;
  RETURN FOUND;
END;
$function$;