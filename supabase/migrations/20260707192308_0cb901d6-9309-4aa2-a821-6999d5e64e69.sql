DROP POLICY IF EXISTS "Internal roles can read demandas" ON public.demandas;

CREATE POLICY "Internal roles can read demandas"
ON public.demandas
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'executivo'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR (
    (has_role(auth.uid(), 'comum'::app_role)
     OR has_role(auth.uid(), 'administradoras'::app_role)
     OR has_role(auth.uid(), 'financeiro'::app_role))
    AND demanda_can_edit(executiva)
  )
  OR (
    has_role(auth.uid(), 'executivo_externo'::app_role)
    AND created_by = auth.uid()
  )
);