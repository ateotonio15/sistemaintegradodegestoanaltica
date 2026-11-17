DROP POLICY IF EXISTS assinatura_email_propria_select ON storage.objects;
CREATE POLICY assinatura_email_propria_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assinaturas-email'
  AND owner_id = (SELECT auth.uid()::text)
  AND name = ANY (ARRAY[(SELECT auth.uid()::text) || '.png', (SELECT auth.uid()::text) || '.jpg'])
);