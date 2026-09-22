CREATE OR REPLACE FUNCTION public.is_saude_reader(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'enfermeira'::app_role)
      OR public.has_role(_uid,'tec_enfermagem'::app_role)
      OR public.has_role(_uid,'diretora'::app_role)
      OR public.has_role(_uid,'diretora_saude'::app_role)
      OR public.has_role(_uid,'executivo'::app_role);
$$;