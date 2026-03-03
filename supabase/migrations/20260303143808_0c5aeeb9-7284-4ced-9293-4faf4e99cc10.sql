
-- Allow comum users to UPDATE movimentacoes for their linked empresas
CREATE POLICY "User update linked movimentacoes" ON public.movimentacoes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid()));
