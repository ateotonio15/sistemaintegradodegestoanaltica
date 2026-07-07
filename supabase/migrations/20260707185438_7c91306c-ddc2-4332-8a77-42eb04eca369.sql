
-- 1. anexos_movimentacao delete policies: restrict to authenticated
DROP POLICY IF EXISTS "Administradoras delete anexos_movimentacao" ON public.anexos_movimentacao;
CREATE POLICY "Administradoras delete anexos_movimentacao"
  ON public.anexos_movimentacao
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role));

DROP POLICY IF EXISTS "Comum delete anexos_movimentacao" ON public.anexos_movimentacao;
CREATE POLICY "Comum delete anexos_movimentacao"
  ON public.anexos_movimentacao
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'comum'::app_role));

-- 2. empresas enfermeira update: restrict to authenticated
DROP POLICY IF EXISTS "Enfermeira update contato empresas" ON public.empresas;
CREATE POLICY "Enfermeira update contato empresas"
  ON public.empresas
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'enfermeira'::app_role))
  WITH CHECK (has_role(auth.uid(), 'enfermeira'::app_role));

-- 3 & 4. financeiro_arquivos: align read roles with other financeiro_* tables (add comum, executivo)
DROP POLICY IF EXISTS "Internal roles read financeiro_arquivos" ON public.financeiro_arquivos;
CREATE POLICY "Internal roles read financeiro_arquivos"
  ON public.financeiro_arquivos
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'visualizacao'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
    OR has_role(auth.uid(), 'executivo'::app_role)
  );
