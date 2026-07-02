
-- DEMANDAS
DROP POLICY IF EXISTS "Internal roles can insert demandas" ON public.demandas;
CREATE POLICY "Internal roles can insert demandas" ON public.demandas
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'executivo'::app_role)
  OR has_role(auth.uid(), 'executivo_externo'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'comum'::app_role)
  OR has_role(auth.uid(), 'administradoras'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
);

DROP POLICY IF EXISTS "Internal roles can read demandas" ON public.demandas;
CREATE POLICY "Internal roles can read demandas" ON public.demandas
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'executivo'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR (
    (
      has_role(auth.uid(), 'comum'::app_role)
      OR has_role(auth.uid(), 'administradoras'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
      OR has_role(auth.uid(), 'executivo_externo'::app_role)
    )
    AND demanda_can_edit(executiva)
  )
);

-- PLANTÕES: leitura restrita à carteira
DROP POLICY IF EXISTS "plantoes_externo_read" ON public.plantoes;
CREATE POLICY "plantoes_externo_read" ON public.plantoes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.plantoes_empresas pe
    JOIN public.empresas e ON lower(trim(e.nome)) = lower(trim(pe.nome))
    JOIN public.empresa_usuarios eu ON eu.empresa_id = e.id
    WHERE pe.id = plantoes.empresa_id
      AND eu.user_id = auth.uid()
  )
);

-- ATENDIMENTOS: leitura + escrita restritas à carteira
DROP POLICY IF EXISTS "plantoes_atend_externo_read" ON public.plantoes_atendimentos;
CREATE POLICY "plantoes_atend_externo_read" ON public.plantoes_atendimentos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.plantoes p
    JOIN public.plantoes_empresas pe ON pe.id = p.empresa_id
    JOIN public.empresas e ON lower(trim(e.nome)) = lower(trim(pe.nome))
    JOIN public.empresa_usuarios eu ON eu.empresa_id = e.id
    WHERE p.id = plantoes_atendimentos.plantao_id
      AND eu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "plantoes_atend_externo_write" ON public.plantoes_atendimentos;
CREATE POLICY "plantoes_atend_externo_write" ON public.plantoes_atendimentos
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.plantoes p
    JOIN public.plantoes_empresas pe ON pe.id = p.empresa_id
    JOIN public.empresas e ON lower(trim(e.nome)) = lower(trim(pe.nome))
    JOIN public.empresa_usuarios eu ON eu.empresa_id = e.id
    WHERE p.id = plantoes_atendimentos.plantao_id
      AND eu.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.plantoes p
    JOIN public.plantoes_empresas pe ON pe.id = p.empresa_id
    JOIN public.empresas e ON lower(trim(e.nome)) = lower(trim(pe.nome))
    JOIN public.empresa_usuarios eu ON eu.empresa_id = e.id
    WHERE p.id = plantoes_atendimentos.plantao_id
      AND eu.user_id = auth.uid()
  )
);

-- EMPRESAS: leitura mínima para carregar carteira
DROP POLICY IF EXISTS "empresas_externo_read" ON public.empresas;
CREATE POLICY "empresas_externo_read" ON public.empresas
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = empresas.id AND eu.user_id = auth.uid()
  )
);

-- PLANTOES_EMPRESAS: leitura para conseguir montar cards de plantão
DROP POLICY IF EXISTS "plantoes_empresas_externo_read" ON public.plantoes_empresas;
CREATE POLICY "plantoes_empresas_externo_read" ON public.plantoes_empresas
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.empresas e
    JOIN public.empresa_usuarios eu ON eu.empresa_id = e.id
    WHERE lower(trim(e.nome)) = lower(trim(plantoes_empresas.nome))
      AND eu.user_id = auth.uid()
  )
);
