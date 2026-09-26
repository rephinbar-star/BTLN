CREATE TABLE public.evaluation_accounts (
  user_id uuid PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.evaluation_accounts TO authenticated;
GRANT ALL ON public.evaluation_accounts TO service_role;
ALTER TABLE public.evaluation_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read evaluation accounts" ON public.evaluation_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.evaluation_accounts(user_id, label) VALUES
 ('2acf9fe9-7a7a-4d7d-890d-a4b445496bfd', 'synthetic A'),
 ('4dba5891-192b-486a-b28c-80c147f11b8c', 'synthetic B')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_evaluation_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT _uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.evaluation_accounts WHERE user_id = _uid) $$;
REVOKE EXECUTE ON FUNCTION public.is_evaluation_user(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_evaluation_user(uuid) TO authenticated, service_role;

ALTER TABLE public.events ADD COLUMN is_evaluation boolean NOT NULL DEFAULT false;
ALTER TABLE public.analyses ADD COLUMN is_evaluation boolean NOT NULL DEFAULT false;

-- Server-owned classification: any client-supplied value is overwritten.
CREATE OR REPLACE FUNCTION public.classify_evaluation_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.is_evaluation := public.is_evaluation_user(NEW.user_id); RETURN NEW; END $$;
CREATE TRIGGER events_classify_evaluation BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.classify_evaluation_event();

CREATE OR REPLACE FUNCTION public.classify_evaluation_analysis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.is_evaluation := public.is_evaluation_user(NEW.user_id)
    OR EXISTS (SELECT 1 FROM public.evaluation_artifacts a WHERE a.source_id = NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER analyses_classify_evaluation BEFORE INSERT OR UPDATE ON public.analyses FOR EACH ROW EXECUTE FUNCTION public.classify_evaluation_analysis();

CREATE OR REPLACE FUNCTION public.evaluation_artifact_mark_analysis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source_kind = 'deep_read' THEN UPDATE public.analyses SET is_evaluation = true WHERE id = NEW.source_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER evaluation_artifact_mark_analysis AFTER INSERT ON public.evaluation_artifacts FOR EACH ROW EXECUTE FUNCTION public.evaluation_artifact_mark_analysis();

UPDATE public.events SET is_evaluation = true WHERE public.is_evaluation_user(user_id);
UPDATE public.analyses SET is_evaluation = true WHERE public.is_evaluation_user(user_id) OR id IN (SELECT source_id FROM public.evaluation_artifacts);

CREATE OR REPLACE FUNCTION public.admin_ai_feedback_aggregate(p_days integer DEFAULT 30)
 RETURNS TABLE(source_kind text, target_kind text, model text, prompt_version text, reason_code text, up_count bigint, down_count bigint, sample_size bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  RETURN QUERY
  SELECT f.source_kind, f.target_kind, f.model, f.prompt_version, rc.code,
         count(*) FILTER (WHERE f.rating = 'up'), count(*) FILTER (WHERE f.rating = 'down'), count(*)
  FROM public.ai_feedback f
  LEFT JOIN LATERAL unnest(COALESCE(NULLIF(f.reason_codes, '{}'), ARRAY[NULL]::text[])) AS rc(code) ON true
  WHERE f.created_at > now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365))
    AND NOT EXISTS (SELECT 1 FROM public.evaluation_artifacts a WHERE a.source_id::text = f.source_id::text)
    AND NOT public.is_evaluation_user(f.user_id)
  GROUP BY 1,2,3,4,5 ORDER BY 7 DESC;
END;
$function$;

CREATE INDEX IF NOT EXISTS events_is_evaluation_idx ON public.events(is_evaluation, created_at);
CREATE INDEX IF NOT EXISTS analyses_is_evaluation_idx ON public.analyses(is_evaluation, created_at);