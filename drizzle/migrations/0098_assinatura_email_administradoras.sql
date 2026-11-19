DROP POLICY IF EXISTS "Cadastro gerencia o proprio remetente" ON public.config_email_remetente_usuario;
CREATE POLICY "Cadastro gerencia o proprio remetente" ON public.config_email_remetente_usuario FOR ALL TO authenticated
USING (user_id = auth.uid() AND (has_role(auth.uid(),'comum') OR has_role(auth.uid(),'administradoras')))
WITH CHECK (user_id = auth.uid() AND (has_role(auth.uid(),'comum') OR has_role(auth.uid(),'administradoras')));

DROP POLICY IF EXISTS assinatura_email_propria_insert ON storage.objects;
DROP POLICY IF EXISTS assinatura_email_propria_update ON storage.objects;
DROP POLICY IF EXISTS assinatura_email_propria_delete ON storage.objects;
CREATE POLICY assinatura_email_propria_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='assinaturas-email' AND name IN (auth.uid()::text||'.png', auth.uid()::text||'.jpg') AND (has_role(auth.uid(),'comum') OR has_role(auth.uid(),'administradoras')));
CREATE POLICY assinatura_email_propria_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='assinaturas-email' AND name IN (auth.uid()::text||'.png', auth.uid()::text||'.jpg') AND (has_role(auth.uid(),'comum') OR has_role(auth.uid(),'administradoras')))
WITH CHECK (bucket_id='assinaturas-email' AND name IN (auth.uid()::text||'.png', auth.uid()::text||'.jpg') AND (has_role(auth.uid(),'comum') OR has_role(auth.uid(),'administradoras')));
CREATE POLICY assinatura_email_propria_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='assinaturas-email' AND name IN (auth.uid()::text||'.png', auth.uid()::text||'.jpg') AND (has_role(auth.uid(),'comum') OR has_role(auth.uid(),'administradoras')));