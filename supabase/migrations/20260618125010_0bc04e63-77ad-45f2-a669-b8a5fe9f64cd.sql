
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
    AND public.demanda_can_edit(executiva)
  )
);

DROP POLICY IF EXISTS "Users manage their own hidden chips" ON public.financeiro_chips_ocultos;

CREATE POLICY "Users manage their own hidden chips"
ON public.financeiro_chips_ocultos
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
