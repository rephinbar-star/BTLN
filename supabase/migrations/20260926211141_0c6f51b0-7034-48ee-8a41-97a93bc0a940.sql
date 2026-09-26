REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.evaluation_artifacts FROM authenticated, anon;
REVOKE ALL ON public.evaluation_artifacts FROM anon;