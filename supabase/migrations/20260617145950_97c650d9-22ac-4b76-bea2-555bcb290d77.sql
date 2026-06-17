CREATE OR REPLACE FUNCTION public.can_access_honda_exclusoes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'diretora'::app_role)
    OR (
      (
        public.has_role(_user_id, 'comum'::app_role)
        OR public.has_role(_user_id, 'administradoras'::app_role)
        OR public.has_role(_user_id, 'financeiro'::app_role)
        OR public.has_role(_user_id, 'executivo'::app_role)
      )
      AND EXISTS (
        SELECT 1
        FROM public.empresa_usuarios eu
        JOIN public.empresas e ON e.id = eu.empresa_id
        WHERE eu.user_id = _user_id
          AND upper(e.nome) ~ '(^|[^A-Z0-9])HONDA([^A-Z0-9]|$)'
      )
    );
$function$;