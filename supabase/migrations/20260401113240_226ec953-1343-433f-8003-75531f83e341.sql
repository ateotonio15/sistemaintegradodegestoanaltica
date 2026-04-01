
CREATE POLICY "Comum user insert movimentacoes"
ON public.movimentacoes
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'comum'::app_role));

CREATE POLICY "Comum user update movimentacoes"
ON public.movimentacoes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'comum'::app_role))
WITH CHECK (has_role(auth.uid(), 'comum'::app_role));
