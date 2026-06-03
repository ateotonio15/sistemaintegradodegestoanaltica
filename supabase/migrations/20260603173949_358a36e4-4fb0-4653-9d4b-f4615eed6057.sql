
-- 1) Add SELECT policy on alertas_financeiro for diretora and visualizacao
CREATE POLICY "Diretora visualizacao read alertas_financeiro"
ON public.alertas_financeiro
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'visualizacao'::app_role)
);

-- 2) Update storage SELECT policy on anexos-implantacao bucket to include administradoras
DROP POLICY IF EXISTS "Restricted read anexos-implantacao" ON storage.objects;

CREATE POLICY "Restricted read anexos-implantacao"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'anexos-implantacao'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'visualizacao'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
    OR has_role(auth.uid(), 'vendas'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
  )
);
