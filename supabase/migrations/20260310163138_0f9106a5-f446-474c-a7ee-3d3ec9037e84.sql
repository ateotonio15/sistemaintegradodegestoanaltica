-- Drop the limited update policy for comum users
DROP POLICY IF EXISTS "Comum user update empresa status" ON public.empresas;

-- Allow comum users to INSERT new empresas
CREATE POLICY "Comum user insert empresas"
ON public.empresas
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'comum'::app_role));

-- Allow comum users to UPDATE any empresa
CREATE POLICY "Comum user update empresas"
ON public.empresas
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'comum'::app_role))
WITH CHECK (has_role(auth.uid(), 'comum'::app_role));