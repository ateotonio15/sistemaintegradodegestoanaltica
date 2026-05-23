
-- Storage: permitir upload e delete pelo perfil Administradoras
DROP POLICY IF EXISTS "Comum upload anexos-movimentacoes storage" ON storage.objects;
CREATE POLICY "Upload anexos-movimentacoes storage"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'anexos-movimentacoes'
  AND (
    has_role(auth.uid(), 'comum'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
  )
);

DROP POLICY IF EXISTS "Comum delete own anexos-movimentacoes storage" ON storage.objects;
CREATE POLICY "Delete own anexos-movimentacoes storage"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'anexos-movimentacoes'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  )
);

-- anexos_movimentacao: permitir INSERT/DELETE para Administradoras
CREATE POLICY "Administradoras insert anexos_movimentacao"
ON public.anexos_movimentacao FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role) AND uploaded_by = auth.uid());

CREATE POLICY "Administradoras delete own anexos_movimentacao"
ON public.anexos_movimentacao FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'administradoras'::app_role) AND uploaded_by = auth.uid());

-- movimentacoes: permitir Administradoras criar/atualizar
CREATE POLICY "Administradoras insert movimentacoes"
ON public.movimentacoes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

CREATE POLICY "Administradoras update movimentacoes"
ON public.movimentacoes FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'administradoras'::app_role))
WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));
