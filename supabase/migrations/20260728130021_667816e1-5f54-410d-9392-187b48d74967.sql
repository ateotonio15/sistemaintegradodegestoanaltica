CREATE OR REPLACE FUNCTION public.get_comum_users_empresa_count()
RETURNS TABLE(user_id uuid, display_name text, empresa_count bigint, empresa_count_atual bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH owner_map AS (
    SELECT
      e.id AS empresa_id,
      e.responsavel_user_id AS atual_owner,
      COALESCE(
        (
          SELECT fce.responsavel_original_user_id
          FROM public.ferias_cadastro_empresas fce
          WHERE fce.empresa_id = e.id
            AND fce.status = 'redistribuida'
          LIMIT 1
        ),
        e.responsavel_user_id
      ) AS original_owner
    FROM public.empresas e
    WHERE e.status_empresa = 'Ativa'
  ), counts AS (
    SELECT
      p.user_id,
      NULLIF(btrim(p.display_name), '') AS display_name,
      COUNT(DISTINCT om_original.empresa_id) AS empresa_count,
      COUNT(DISTINCT om_atual.empresa_id) AS empresa_count_atual
    FROM public.profiles p
    INNER JOIN public.user_roles ur
      ON ur.user_id = p.user_id
     AND ur.role = 'comum'
    LEFT JOIN owner_map om_original
      ON om_original.original_owner = p.user_id
    LEFT JOIN owner_map om_atual
      ON om_atual.atual_owner = p.user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.empresa_usuarios eu
      INNER JOIN public.empresas emp
        ON emp.id = eu.empresa_id
      WHERE eu.user_id = p.user_id
        AND lower(btrim(COALESCE(p.display_name, ''))) = lower(btrim(COALESCE(emp.nome, '')))
    )
    GROUP BY p.user_id, p.display_name
  )
  SELECT
    counts.user_id,
    COALESCE(counts.display_name, 'Sem nome') AS display_name,
    counts.empresa_count,
    counts.empresa_count_atual
  FROM counts
  WHERE counts.empresa_count > 0
     OR counts.empresa_count_atual > 0
  ORDER BY COALESCE(counts.display_name, 'Sem nome');
$function$;