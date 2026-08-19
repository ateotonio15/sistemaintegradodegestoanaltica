DROP POLICY IF EXISTS "Admin read arquivos-financeiro" ON storage.objects;
CREATE POLICY "Read arquivos-financeiro" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'arquivos-financeiro' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_interno'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'coordenadora'::app_role)
    OR owner = auth.uid()
  )
);

DROP POLICY IF EXISTS "Restricted read anexos-financeiro storage" ON storage.objects;
CREATE POLICY "Restricted read anexos-financeiro storage" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'anexos-financeiro' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_interno'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'coordenadora'::app_role)
    OR has_role(auth.uid(), 'visualizacao'::app_role)
    OR owner = auth.uid()
  )
);