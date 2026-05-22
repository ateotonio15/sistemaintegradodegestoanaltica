DROP POLICY IF EXISTS "Vendas delete implantacoes" ON public.implantacoes_contratos;
CREATE POLICY "Vendas delete own implantacoes"
ON public.implantacoes_contratos
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'vendas'::app_role) AND created_by = auth.uid());