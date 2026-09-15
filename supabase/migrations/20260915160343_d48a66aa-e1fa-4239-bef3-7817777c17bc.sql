CREATE OR REPLACE FUNCTION public.plantao_do_usuario(_plantao_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.plantoes p
    LEFT JOIN public.profiles pr ON pr.id = _user_id
    WHERE p.id = _plantao_id
      AND (
        p.created_by = _user_id
        OR (
          p.plantonista IS NOT NULL
          AND pr.display_name IS NOT NULL
          AND lower(btrim(p.plantonista)) = lower(btrim(pr.display_name))
        )
        OR EXISTS (
          SELECT 1 FROM public.plantoes_atendimentos a
          WHERE a.plantao_id = p.id AND a.created_by = _user_id
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.empresa_plantao_do_usuario(_empresa_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plantoes p
    WHERE p.empresa_id = _empresa_id
      AND public.plantao_do_usuario(p.id, _user_id)
  )
$$;

DROP POLICY IF EXISTS plantoes_externo_proprio_read ON public.plantoes;
CREATE POLICY plantoes_externo_proprio_read ON public.plantoes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND public.plantao_do_usuario(id, auth.uid())
);

DROP POLICY IF EXISTS plantoes_empresas_externo_proprio_read ON public.plantoes_empresas;
CREATE POLICY plantoes_empresas_externo_proprio_read ON public.plantoes_empresas
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND public.empresa_plantao_do_usuario(id, auth.uid())
);

DROP POLICY IF EXISTS plantoes_atend_externo_proprio_read ON public.plantoes_atendimentos;
CREATE POLICY plantoes_atend_externo_proprio_read ON public.plantoes_atendimentos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND public.plantao_do_usuario(plantao_id, auth.uid())
);