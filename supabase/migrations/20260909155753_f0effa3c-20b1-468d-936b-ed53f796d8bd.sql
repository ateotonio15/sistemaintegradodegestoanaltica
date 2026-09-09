CREATE OR REPLACE FUNCTION public.can_access_triagem_row(_uid uuid, _empresa_id uuid, _created_by uuid, _acao_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_uid, 'admin'::public.app_role)
    OR public.has_role(_uid, 'diretora'::public.app_role)
    OR public.has_role(_uid, 'enfermeira'::public.app_role)
    OR public.has_role(_uid, 'tec_enfermagem'::public.app_role);
$function$;