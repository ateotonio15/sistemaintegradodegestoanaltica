
-- mailing_brindes: restrict SELECT to admin/executivo/comum/administradoras
DROP POLICY IF EXISTS "auth select mailing" ON public.mailing_brindes;
CREATE POLICY "mailing_brindes_role_select" ON public.mailing_brindes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'executivo'::app_role)
  OR has_role(auth.uid(), 'comum'::app_role)
  OR has_role(auth.uid(), 'administradoras'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
);

-- plantoes: restrict SELECT to roles that use this module
DROP POLICY IF EXISTS "plantoes_auth_read" ON public.plantoes;
CREATE POLICY "plantoes_role_read" ON public.plantoes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'enfermeira'::app_role)
  OR has_role(auth.uid(), 'executivo'::app_role)
);

-- plantoes_empresas: same restriction
DROP POLICY IF EXISTS "plantoes_empresas_auth_read" ON public.plantoes_empresas;
CREATE POLICY "plantoes_empresas_role_read" ON public.plantoes_empresas
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'enfermeira'::app_role)
  OR has_role(auth.uid(), 'executivo'::app_role)
);

-- uber_corridas: restrict SELECT to admin/financeiro/diretora
DROP POLICY IF EXISTS "Authenticated can view uber_corridas" ON public.uber_corridas;
CREATE POLICY "uber_corridas_role_read" ON public.uber_corridas
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
);
