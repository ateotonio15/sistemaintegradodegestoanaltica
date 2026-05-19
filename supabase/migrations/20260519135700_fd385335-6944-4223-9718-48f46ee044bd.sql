
DROP POLICY IF EXISTS "Admin/Comum write anexos-implantacao" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Comum update anexos-implantacao" ON storage.objects;
DROP POLICY IF EXISTS "Admin/Comum delete anexos-implantacao" ON storage.objects;

CREATE POLICY "Implantacao write anexos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'anexos-implantacao' AND (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'comum'::app_role)
    OR has_role(auth.uid(),'vendas'::app_role)
    OR has_role(auth.uid(),'diretora'::app_role)
  )
);

CREATE POLICY "Implantacao update anexos" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'anexos-implantacao' AND (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'comum'::app_role)
    OR has_role(auth.uid(),'vendas'::app_role)
    OR has_role(auth.uid(),'diretora'::app_role)
  )
);

CREATE POLICY "Implantacao delete anexos" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'anexos-implantacao' AND (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'comum'::app_role)
    OR has_role(auth.uid(),'vendas'::app_role)
    OR has_role(auth.uid(),'diretora'::app_role)
  )
);
