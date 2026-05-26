
-- Permitir Financeiro acessar anexos de implantação (apenas o que ele anexar para inserir/excluir)
-- 1) Tabela implantacao_anexos
DROP POLICY IF EXISTS "Scoped read impl anexos" ON public.implantacao_anexos;
CREATE POLICY "Scoped read impl anexos"
  ON public.implantacao_anexos
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'visualizacao'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR (
      has_role(auth.uid(), 'vendas'::app_role)
      AND EXISTS (
        SELECT 1 FROM implantacoes_contratos ic
        WHERE ic.id = implantacao_anexos.implantacao_id
          AND ic.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Financeiro insert impl anexos"
  ON public.implantacao_anexos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'financeiro'::app_role)
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Financeiro delete own impl anexos"
  ON public.implantacao_anexos
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'financeiro'::app_role)
    AND uploaded_by = auth.uid()
  );

-- 2) Storage bucket anexos-implantacao
DROP POLICY IF EXISTS "Restricted read anexos-implantacao" ON storage.objects;
CREATE POLICY "Restricted read anexos-implantacao"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'anexos-implantacao'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'vendas'::app_role)
      OR has_role(auth.uid(), 'diretora'::app_role)
      OR has_role(auth.uid(), 'comum'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
    )
  );

DROP POLICY IF EXISTS "Implantacao write anexos" ON storage.objects;
CREATE POLICY "Implantacao write anexos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'anexos-implantacao'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'comum'::app_role)
      OR has_role(auth.uid(), 'vendas'::app_role)
      OR has_role(auth.uid(), 'diretora'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
    )
  );

DROP POLICY IF EXISTS "Implantacao delete anexos" ON storage.objects;
CREATE POLICY "Implantacao delete anexos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'anexos-implantacao'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'comum'::app_role)
      OR has_role(auth.uid(), 'vendas'::app_role)
      OR has_role(auth.uid(), 'diretora'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
    )
  );
