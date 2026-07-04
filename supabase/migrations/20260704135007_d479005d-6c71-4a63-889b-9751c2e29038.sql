CREATE OR REPLACE FUNCTION public.demanda_can_edit(_executiva text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'executivo'::app_role)
    OR public.has_role(auth.uid(), 'executivo_externo'::app_role)
    OR (
      NOT public.has_role(auth.uid(), 'diretora'::app_role)
      AND NOT public.has_role(auth.uid(), 'visualizacao'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND _executiva IS NOT NULL
          AND lower(trim(p.display_name)) = lower(trim(_executiva))
      )
    );
$function$;