DROP FUNCTION IF EXISTS public.get_comum_users_empresa_count();

CREATE OR REPLACE FUNCTION public.get_comum_users_empresa_count()
RETURNS TABLE(user_id uuid, display_name text, empresa_count bigint, empresa_count_atual bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH owner_map AS (
    SELECT e.id AS empresa_id,
      e.responsavel_user_id AS atual_owner,
      COALESCE(
        (SELECT fce.responsavel_original_user_id
           FROM ferias_cadastro_empresas fce
          WHERE fce.empresa_id = e.id
            AND fce.status = 'redistribuida'
          LIMIT 1),
        e.responsavel_user_id
      ) AS original_owner
    FROM empresas e
    WHERE e.status_empresa = 'Ativa'
  )
  SELECT p.user_id, p.display_name,
    (SELECT count(*) FROM owner_map om WHERE om.original_owner = p.user_id) AS empresa_count,
    (SELECT count(*) FROM owner_map om WHERE om.atual_owner = p.user_id) AS empresa_count_atual
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.user_id AND ur.role = 'comum'
  ORDER BY p.display_name;
$function$;