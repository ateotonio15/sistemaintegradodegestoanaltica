CREATE POLICY "Financeiro view all movimentacoes"
ON public.movimentacoes
FOR SELECT
USING (has_role(auth.uid(), 'financeiro'::app_role));