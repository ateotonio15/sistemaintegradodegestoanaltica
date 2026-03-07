
CREATE OR REPLACE FUNCTION public.get_comum_users_empresa_count()
RETURNS TABLE(user_id uuid, display_name text, empresa_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.user_id, p.display_name, 
    (SELECT count(*) FROM empresas e WHERE e.responsavel_user_id = p.user_id AND e.status_empresa = 'Ativa') as empresa_count
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.user_id AND ur.role = 'comum'
  ORDER BY p.display_name;
$$;
