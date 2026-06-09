CREATE POLICY "Diretora manage reajustes_anuais"
ON public.reajustes_anuais
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'diretora'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretora'::app_role));