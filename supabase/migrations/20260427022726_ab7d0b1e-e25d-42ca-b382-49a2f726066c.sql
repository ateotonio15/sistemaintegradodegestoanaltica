-- Allow financeiro role to upload to anexos-financeiro bucket
CREATE POLICY "Financeiro upload anexos-financeiro storage"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'anexos-financeiro'
  AND has_role(auth.uid(), 'financeiro'::app_role)
);

-- Allow financeiro role to update files in anexos-financeiro bucket
CREATE POLICY "Financeiro update anexos-financeiro storage"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anexos-financeiro'
  AND has_role(auth.uid(), 'financeiro'::app_role)
);

-- Allow financeiro role to delete files in anexos-financeiro bucket
CREATE POLICY "Financeiro delete anexos-financeiro storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'anexos-financeiro'
  AND has_role(auth.uid(), 'financeiro'::app_role)
);