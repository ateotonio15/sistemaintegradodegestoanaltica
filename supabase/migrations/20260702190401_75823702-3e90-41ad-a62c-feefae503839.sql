
CREATE POLICY plantoes_externo_write ON public.plantoes
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'executivo_externo'::app_role) AND EXISTS (
    SELECT 1 FROM plantoes_empresas pe
    JOIN empresas e ON lower(trim(e.nome)) = lower(trim(pe.nome))
    JOIN empresa_usuarios eu ON eu.empresa_id = e.id
    WHERE pe.id = plantoes.empresa_id AND eu.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'executivo_externo'::app_role) AND EXISTS (
    SELECT 1 FROM plantoes_empresas pe
    JOIN empresas e ON lower(trim(e.nome)) = lower(trim(pe.nome))
    JOIN empresa_usuarios eu ON eu.empresa_id = e.id
    WHERE pe.id = plantoes.empresa_id AND eu.user_id = auth.uid()
  )
);
