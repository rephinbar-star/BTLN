CREATE OR REPLACE FUNCTION public.set_couple_type_image_url(
  p_type_id integer,
  p_relationship_type text,
  p_image_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_col text;
BEGIN
  IF p_relationship_type NOT IN ('romantic','friend','family') THEN
    RAISE EXCEPTION 'invalid relationship_type: %', p_relationship_type;
  END IF;
  v_col := 'image_url_' || p_relationship_type;
  EXECUTE format('UPDATE public.couple_types SET %I = $1 WHERE id = $2', v_col)
    USING p_image_url, p_type_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_couple_type_image_url(integer, text, text) TO anon, authenticated;