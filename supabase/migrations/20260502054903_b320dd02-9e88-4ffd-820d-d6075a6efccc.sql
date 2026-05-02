-- =========================
-- prompt_versions
-- =========================
CREATE TABLE public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number integer NOT NULL UNIQUE,
  prompt_text text NOT NULL,
  model_string text NOT NULL DEFAULT 'anthropic/claude-sonnet-4.5',
  vision_model_string text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  active boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active prompt at a time
CREATE UNIQUE INDEX prompt_versions_one_active
  ON public.prompt_versions ((active))
  WHERE active = true;

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
-- No policies = no anon access. Service role bypasses RLS.

INSERT INTO public.prompt_versions (version_number, prompt_text, active, notes)
VALUES (1, 'PASTE_PROMPT_HERE', true, 'Initial placeholder — replace via dashboard.');

-- =========================
-- analyses
-- =========================
CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  prompt_version_id uuid REFERENCES public.prompt_versions(id),
  context_data jsonb NOT NULL,
  result_json jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','extracting','analyzing','complete','failed')),
  error_message text,
  input_method text NOT NULL
    CHECK (input_method IN ('paste','chat_file','screenshot')),
  message_count integer,
  feedback_score integer CHECK (feedback_score BETWEEN 1 AND 10),
  feedback_text text,
  feedback_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX analyses_session_idx ON public.analyses (session_id, created_at DESC);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Anyone can create an analysis (anonymous app)
CREATE POLICY "Anyone can insert analyses"
  ON public.analyses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anyone can read a specific analysis (report page is shareable by URL)
CREATE POLICY "Anyone can read analyses"
  ON public.analyses FOR SELECT
  TO anon, authenticated
  USING (true);

-- No public UPDATE / DELETE — feedback goes through submit_feedback() below.

-- =========================
-- messages_temp
-- =========================
CREATE TABLE public.messages_temp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user','partner')),
  content text NOT NULL,
  timestamp_estimate text,
  sequence_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_temp_analysis_idx ON public.messages_temp (analysis_id, sequence_order);

ALTER TABLE public.messages_temp ENABLE ROW LEVEL SECURITY;
-- No policies = no anon access. Service role bypasses RLS.

-- =========================
-- events
-- =========================
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  event_name text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_session_idx ON public.events (session_id, created_at DESC);
CREATE INDEX events_name_idx ON public.events (event_name, created_at DESC);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert events"
  ON public.events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
-- No SELECT policy = no public reads.

-- =========================
-- email_captures
-- =========================
CREATE TABLE public.email_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  analysis_id uuid REFERENCES public.analyses(id),
  source text DEFAULT 'feedback_modal',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert email captures"
  ON public.email_captures FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
-- No SELECT policy = no public reads.

-- =========================
-- share_clicks
-- =========================
CREATE TABLE public.share_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES public.analyses(id),
  platform text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX share_clicks_analysis_idx ON public.share_clicks (analysis_id);

ALTER TABLE public.share_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert share clicks"
  ON public.share_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
-- No SELECT policy = no public reads.

-- =========================
-- submit_feedback function
-- Lets the client safely update only feedback fields on an analysis.
-- =========================
CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_analysis_id uuid,
  p_score integer,
  p_text text,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_score IS NOT NULL AND (p_score < 1 OR p_score > 10) THEN
    RAISE EXCEPTION 'feedback_score must be between 1 and 10';
  END IF;

  UPDATE public.analyses
     SET feedback_score = COALESCE(p_score, feedback_score),
         feedback_text  = COALESCE(p_text,  feedback_text),
         feedback_email = COALESCE(p_email, feedback_email)
   WHERE id = p_analysis_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_feedback(uuid, integer, text, text) TO anon, authenticated;