CREATE POLICY "Financeiro insert movimentacoes"
ON public.movimentacoes
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));