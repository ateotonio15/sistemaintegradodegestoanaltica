CREATE OR REPLACE FUNCTION public.get_user_display_names(_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, COALESCE(p.display_name, p.username, '') AS display_name
  FROM public.profiles p
  WHERE p.user_id = ANY(_ids)
$$;

GRANT EXECUTE ON FUNCTION public.get_user_display_names(uuid[]) TO authenticated;