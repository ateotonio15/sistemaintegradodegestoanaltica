
-- Storage: anexos-financeiro read restriction
DROP POLICY IF EXISTS "Authenticated read anexos-financeiro storage" ON storage.objects;
CREATE POLICY "Restricted read anexos-financeiro storage"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'anexos-financeiro' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'visualizacao'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
  )
);

-- Storage: anexos-implantacao read restriction
DROP POLICY IF EXISTS "Auth read anexos-implantacao" ON storage.objects;
CREATE POLICY "Restricted read anexos-implantacao"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'anexos-implantacao' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'vendas'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
  )
);

-- Storage: anexos-movimentacoes read restriction
DROP POLICY IF EXISTS "Authenticated read anexos-movimentacoes storage" ON storage.objects;
CREATE POLICY "Restricted read anexos-movimentacoes storage"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'anexos-movimentacoes' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'visualizacao'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
    OR has_role(auth.uid(), 'executivo'::app_role)
  )
);

-- movimentacoes: scope public policies to authenticated
DROP POLICY IF EXISTS "Financeiro view all movimentacoes" ON public.movimentacoes;
CREATE POLICY "Financeiro view all movimentacoes"
ON public.movimentacoes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "User view linked movimentacoes" ON public.movimentacoes;
CREATE POLICY "User view linked movimentacoes"
ON public.movimentacoes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = movimentacoes.empresa_id AND e.responsavel_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "User update linked movimentacoes" ON public.movimentacoes;
CREATE POLICY "User update linked movimentacoes"
ON public.movimentacoes FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = movimentacoes.empresa_id AND e.responsavel_user_id = auth.uid()
  )
);
