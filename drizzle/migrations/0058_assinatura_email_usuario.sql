ALTER TABLE public.config_email_remetente_usuario ADD COLUMN IF NOT EXISTS assinatura_path TEXT;

CREATE POLICY assinatura_email_propria_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assinaturas-email' AND (name = auth.uid()::text || '.png' OR name = auth.uid()::text || '.jpg' OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY assinatura_email_propria_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assinaturas-email' AND (name = auth.uid()::text || '.png' OR name = auth.uid()::text || '.jpg') AND public.has_role(auth.uid(), 'comum'));
CREATE POLICY assinatura_email_propria_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'assinaturas-email' AND (name = auth.uid()::text || '.png' OR name = auth.uid()::text || '.jpg') AND public.has_role(auth.uid(), 'comum'));
CREATE POLICY assinatura_email_propria_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assinaturas-email' AND (name = auth.uid()::text || '.png' OR name = auth.uid()::text || '.jpg') AND public.has_role(auth.uid(), 'comum'));