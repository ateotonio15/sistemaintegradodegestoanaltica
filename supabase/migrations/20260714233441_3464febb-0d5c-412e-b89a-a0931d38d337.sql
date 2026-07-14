
CREATE POLICY "staff_interno_le_atendimentos" ON public.atendimentos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'comum'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
  OR public.has_role(auth.uid(), 'visualizacao'::app_role)
);

CREATE POLICY "staff_interno_atualiza_atendimentos" ON public.atendimentos
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'comum'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'comum'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
);

CREATE POLICY "staff_interno_le_redirecionamentos" ON public.atendimentos_redirecionamentos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'comum'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
  OR public.has_role(auth.uid(), 'visualizacao'::app_role)
);

CREATE POLICY "staff_interno_insere_redirecionamentos" ON public.atendimentos_redirecionamentos
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'comum'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
);
