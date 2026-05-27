
-- Fix: scope implantacao_alertas ALL policies to authenticated
DROP POLICY IF EXISTS "Cadastro manage impl alertas" ON public.implantacao_alertas;
DROP POLICY IF EXISTS "Diretora manage impl alertas" ON public.implantacao_alertas;
DROP POLICY IF EXISTS "Vendas manage impl alertas" ON public.implantacao_alertas;

CREATE POLICY "Cadastro manage impl alertas"
  ON public.implantacao_alertas
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'comum'::app_role) AND destinatario_role = 'comum' AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid()))
  WITH CHECK (has_role(auth.uid(),'comum'::app_role) AND destinatario_role = 'comum' AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid()));

CREATE POLICY "Diretora manage impl alertas"
  ON public.implantacao_alertas
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'diretora'::app_role) AND destinatario_role = 'diretora')
  WITH CHECK (has_role(auth.uid(),'diretora'::app_role) AND destinatario_role = 'diretora');

CREATE POLICY "Vendas manage impl alertas"
  ON public.implantacao_alertas
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'vendas'::app_role) AND (destinatario_role = 'vendas' OR criado_por = auth.uid()))
  WITH CHECK (has_role(auth.uid(),'vendas'::app_role) AND (destinatario_role = 'vendas' OR criado_por = auth.uid()));

-- Fix: restrict vendas read on implantacoes_contratos to own rows
DROP POLICY IF EXISTS "Vendas read implantacoes" ON public.implantacoes_contratos;

CREATE POLICY "Vendas read implantacoes"
  ON public.implantacoes_contratos
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(),'vendas'::app_role) AND created_by = auth.uid());
