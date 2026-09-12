-- Somente vendas (e admin) podem criar/gerenciar implantações.
-- Comum e Administradoras passam a apenas visualizar.
DROP POLICY "Comum manage implantacoes" ON public.implantacoes_contratos;
DROP POLICY "Administradoras manage implantacoes" ON public.implantacoes_contratos;

CREATE POLICY "Comum read implantacoes"
  ON public.implantacoes_contratos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'comum'::app_role));

CREATE POLICY "Vendas insert implantacoes"
  ON public.implantacoes_contratos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'vendas'::app_role) AND created_by = auth.uid());

CREATE POLICY "Vendas update own implantacoes"
  ON public.implantacoes_contratos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'vendas'::app_role) AND created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'vendas'::app_role) AND created_by = auth.uid());