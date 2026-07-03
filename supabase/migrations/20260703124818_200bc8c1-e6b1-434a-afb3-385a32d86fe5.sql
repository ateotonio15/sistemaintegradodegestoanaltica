
-- Add created_by ownership to plantoes tables
ALTER TABLE public.plantoes_empresas ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.plantoes ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.plantoes_atendimentos ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- Restrict executivo_externo to only see/edit rows they created
DROP POLICY IF EXISTS plantoes_empresas_externo_read ON public.plantoes_empresas;
CREATE POLICY plantoes_empresas_externo_read ON public.plantoes_empresas
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role) AND created_by = auth.uid());

DROP POLICY IF EXISTS plantoes_empresas_externo_write ON public.plantoes_empresas;
CREATE POLICY plantoes_empresas_externo_write ON public.plantoes_empresas
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'executivo_externo'::app_role) AND (created_by = auth.uid() OR created_by IS NULL));

DROP POLICY IF EXISTS plantoes_externo_read ON public.plantoes;
CREATE POLICY plantoes_externo_read ON public.plantoes
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role) AND created_by = auth.uid());

DROP POLICY IF EXISTS plantoes_externo_write ON public.plantoes;
CREATE POLICY plantoes_externo_write ON public.plantoes
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'executivo_externo'::app_role) AND (created_by = auth.uid() OR created_by IS NULL));

DROP POLICY IF EXISTS plantoes_atend_externo_read ON public.plantoes_atendimentos;
CREATE POLICY plantoes_atend_externo_read ON public.plantoes_atendimentos
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role) AND created_by = auth.uid());

DROP POLICY IF EXISTS plantoes_atend_externo_write ON public.plantoes_atendimentos;
CREATE POLICY plantoes_atend_externo_write ON public.plantoes_atendimentos
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'executivo_externo'::app_role) AND (created_by = auth.uid() OR created_by IS NULL));
