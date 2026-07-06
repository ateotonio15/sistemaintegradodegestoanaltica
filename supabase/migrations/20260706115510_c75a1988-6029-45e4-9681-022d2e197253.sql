
CREATE POLICY "Executivo externo view all empresas" ON public.empresas
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'executivo_externo'::app_role));
