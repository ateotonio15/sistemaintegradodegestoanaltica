
DROP POLICY IF EXISTS empresas_externo_read ON public.empresas;
CREATE POLICY empresas_externo_read ON public.empresas
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executivo_externo'::app_role));
