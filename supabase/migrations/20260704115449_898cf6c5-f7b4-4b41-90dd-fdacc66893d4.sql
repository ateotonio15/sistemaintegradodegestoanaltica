DROP POLICY IF EXISTS "empresas_externo_read" ON public.empresas;

CREATE POLICY "empresas_externo_read" ON public.empresas
FOR SELECT
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role)
  AND (
    responsavel_user_id = auth.uid()
    OR executiva_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.empresa_id = empresas.id
        AND eu.user_id = auth.uid()
    )
  )
);