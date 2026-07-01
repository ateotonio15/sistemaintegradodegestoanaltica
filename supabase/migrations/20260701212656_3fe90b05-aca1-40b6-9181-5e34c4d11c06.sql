-- Tighten Administradoras policy on implantacao_alertas: require a specific destinatario_user_id on INSERT/UPDATE
DROP POLICY IF EXISTS "Administradoras manage impl alertas" ON public.implantacao_alertas;

CREATE POLICY "Administradoras read impl alertas"
ON public.implantacao_alertas FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'administradoras'::app_role)
  AND (destinatario_role IN ('administradoras','comum'))
  AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid())
);

CREATE POLICY "Administradoras write impl alertas"
ON public.implantacao_alertas FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'administradoras'::app_role)
  AND destinatario_user_id IS NOT NULL
  AND (destinatario_role IN ('administradoras','comum'))
);

CREATE POLICY "Administradoras update impl alertas"
ON public.implantacao_alertas FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'administradoras'::app_role)
  AND (destinatario_role IN ('administradoras','comum'))
  AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'administradoras'::app_role)
  AND destinatario_user_id IS NOT NULL
  AND (destinatario_role IN ('administradoras','comum'))
);

CREATE POLICY "Administradoras delete impl alertas"
ON public.implantacao_alertas FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'administradoras'::app_role)
  AND (destinatario_role IN ('administradoras','comum'))
  AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid())
);

-- Add UPDATE policy for anexos-movimentacoes bucket mirroring DELETE
CREATE POLICY "Update own anexos-movimentacoes storage"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'anexos-movimentacoes'
  AND (owner = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
)
WITH CHECK (
  bucket_id = 'anexos-movimentacoes'
  AND (owner = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
);