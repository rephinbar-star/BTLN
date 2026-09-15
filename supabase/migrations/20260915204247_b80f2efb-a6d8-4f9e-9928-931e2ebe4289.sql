CREATE OR REPLACE FUNCTION public.list_roastable_sources(p_session_id uuid)
RETURNS TABLE(
  source_type text,
  source_id uuid,
  label text,
  category text,
  is_unlocked boolean,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'analysis'::text,
         a.id,
         COALESCE(NULLIF(TRIM(COALESCE(a.context_data->>'name1','') || ' & ' || COALESCE(a.context_data->>'name2','')), '&'), 'Deep Read'),
         COALESCE(a.relationship_type, 'romantic'),
         (a.is_paid OR public.user_has_paid_access(auth.uid(), a.id)),
         a.created_at
    FROM public.analyses a
   WHERE a.status = 'complete'
     AND a.result_json IS NOT NULL
     AND (
       (auth.uid() IS NOT NULL AND a.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND a.session_id = p_session_id AND a.user_id IS NULL)
     )
  UNION ALL
  SELECT 'group_read'::text,
         g.id,
         g.participant_count || ' people',
         g.category,
         true,
         g.created_at
    FROM public.group_reads g
   WHERE g.status = 'complete'
     AND g.result_json IS NOT NULL
     AND (
       (auth.uid() IS NOT NULL AND g.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND g.session_id = p_session_id AND g.user_id IS NULL)
     )
   ORDER BY 6 DESC
   LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION public.list_roastable_sources(uuid) TO anon, authenticated;