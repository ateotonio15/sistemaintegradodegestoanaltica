CREATE POLICY "Vendas read uber_corridas"
ON public.uber_corridas
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'vendas'::app_role));