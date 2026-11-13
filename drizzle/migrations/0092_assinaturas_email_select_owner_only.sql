DROP POLICY IF EXISTS assinatura_email_propria_select ON storage.objects;
CREATE POLICY assinatura_email_propria_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assinaturas-email' AND (owner_id = (select auth.uid()::text) OR name = ANY (ARRAY[(select auth.uid()::text) || '.png', (select auth.uid()::text) || '.jpg'])));