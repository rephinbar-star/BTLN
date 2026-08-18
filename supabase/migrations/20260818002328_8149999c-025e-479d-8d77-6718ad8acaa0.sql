ALTER TABLE public.prompt_versions ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'full';

DROP INDEX IF EXISTS public.prompt_versions_one_active;
CREATE UNIQUE INDEX prompt_versions_one_active_per_kind
  ON public.prompt_versions (active, kind) WHERE (active = true);

INSERT INTO public.prompt_versions (version_number, prompt_text, model_string, vision_model_string, active, kind, notes)
VALUES (
  (SELECT COALESCE(MAX(version_number), 0) + 1 FROM public.prompt_versions),
  'PENDING',
  'google/gemini-3-flash-preview',
  'google/gemini-3-flash-preview',
  true,
  'decode',
  'Placeholder decode prompt'
);

CREATE TABLE public.decodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid NOT NULL,
  source text,
  result_json jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  relationship_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.decodes TO authenticated;
GRANT INSERT ON public.decodes TO anon;
GRANT ALL ON public.decodes TO service_role;

ALTER TABLE public.decodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert decodes as self or anonymous"
  ON public.decodes FOR INSERT TO anon, authenticated
  WITH CHECK ((user_id IS NULL) OR (auth.uid() IS NOT NULL AND auth.uid() = user_id));

CREATE POLICY "Read own decodes"
  ON public.decodes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE INDEX decodes_session_id_idx ON public.decodes (session_id);

CREATE OR REPLACE FUNCTION public.get_decode_for_session(p_id uuid, p_session_id uuid)
RETURNS TABLE(id uuid, status text, result_json jsonb, source text, error_message text, relationship_id uuid, user_id uuid, session_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT d.id, d.status, d.result_json, d.source, d.error_message,
         d.relationship_id, d.user_id, d.session_id
    FROM public.decodes d
   WHERE d.id = p_id
     AND (
       (auth.uid() IS NOT NULL AND d.user_id = auth.uid())
       OR (p_session_id IS NOT NULL AND d.session_id = p_session_id)
     )
   LIMIT 1;
$function$;