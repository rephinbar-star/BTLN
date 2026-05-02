ALTER TABLE public.prompt_versions
  ALTER COLUMN model_string SET DEFAULT 'anthropic/claude-sonnet-4.6',
  ALTER COLUMN vision_model_string SET DEFAULT 'google/gemini-3-flash-preview';