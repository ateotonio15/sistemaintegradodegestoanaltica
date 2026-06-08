
DROP POLICY IF EXISTS ferias_select_all_auth ON public.ferias_cadastro;
CREATE POLICY ferias_select_scoped ON public.ferias_cadastro
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'comum'::app_role)
  OR has_role(auth.uid(), 'executivo'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'visualizacao'::app_role)
);

DROP POLICY IF EXISTS ferias_emp_select ON public.ferias_cadastro_empresas;
CREATE POLICY ferias_emp_select_scoped ON public.ferias_cadastro_empresas
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'comum'::app_role)
  OR has_role(auth.uid(), 'executivo'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'visualizacao'::app_role)
);
