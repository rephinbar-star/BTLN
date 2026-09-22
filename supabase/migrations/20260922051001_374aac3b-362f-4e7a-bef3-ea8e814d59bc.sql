CREATE OR REPLACE FUNCTION public.journey_purge_deleted_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_kind text := TG_ARGV[0]; v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(s.id), '{}') INTO v_ids
    FROM public.journey_sources s
   WHERE s.source_kind = v_kind AND s.source_id = OLD.id;

  IF array_length(v_ids, 1) IS NULL THEN RETURN OLD; END IF;

  UPDATE public.journey_summaries u
     SET is_stale = true, updated_at = now()
   WHERE u.evidence_source_ids && v_ids;

  DELETE FROM public.journey_observations o WHERE o.journey_source_id = ANY(v_ids);
  DELETE FROM public.journey_sources s WHERE s.id = ANY(v_ids);
  RETURN OLD;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.journey_purge_deleted_source() FROM anon, authenticated;

DROP TRIGGER IF EXISTS journey_purge_decode ON public.decodes;
CREATE TRIGGER journey_purge_decode AFTER DELETE ON public.decodes
FOR EACH ROW EXECUTE FUNCTION public.journey_purge_deleted_source('quick_take');

DROP TRIGGER IF EXISTS journey_purge_analysis ON public.analyses;
CREATE TRIGGER journey_purge_analysis AFTER DELETE ON public.analyses
FOR EACH ROW EXECUTE FUNCTION public.journey_purge_deleted_source('deep_read');

DROP TRIGGER IF EXISTS journey_purge_group_read ON public.group_reads;
CREATE TRIGGER journey_purge_group_read AFTER DELETE ON public.group_reads
FOR EACH ROW EXECUTE FUNCTION public.journey_purge_deleted_source('group_read');

DROP TRIGGER IF EXISTS journey_purge_group_roast ON public.group_roasts;
CREATE TRIGGER journey_purge_group_roast AFTER DELETE ON public.group_roasts
FOR EACH ROW EXECUTE FUNCTION public.journey_purge_deleted_source('group_roast');