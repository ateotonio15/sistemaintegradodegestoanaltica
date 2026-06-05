
-- 1) Re-scope Administradoras policies to {authenticated}

DROP POLICY IF EXISTS "Administradoras view all roles" ON public.user_roles;
CREATE POLICY "Administradoras view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role));

DROP POLICY IF EXISTS "Administradoras update own alertas_reajuste" ON public.alertas_reajuste;
CREATE POLICY "Administradoras update own alertas_reajuste" ON public.alertas_reajuste
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role) AND destinatario_user_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role) AND destinatario_user_id = auth.uid());

DROP POLICY IF EXISTS "Administradoras manage reajustes_anuais" ON public.reajustes_anuais;
CREATE POLICY "Administradoras manage reajustes_anuais" ON public.reajustes_anuais
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role) AND (
    EXISTS (SELECT 1 FROM empresas e WHERE e.id = reajustes_anuais.empresa_id AND e.responsavel_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = reajustes_anuais.empresa_id AND eu.user_id = auth.uid())
  ))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role) AND (
    EXISTS (SELECT 1 FROM empresas e WHERE e.id = reajustes_anuais.empresa_id AND e.responsavel_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = reajustes_anuais.empresa_id AND eu.user_id = auth.uid())
  ));

DROP POLICY IF EXISTS "Administradoras manage reajuste_faixas" ON public.reajuste_faixas;
CREATE POLICY "Administradoras manage reajuste_faixas" ON public.reajuste_faixas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role) AND EXISTS (
    SELECT 1 FROM reajustes_anuais ra
    WHERE ra.id = reajuste_faixas.reajuste_id AND (
      EXISTS (SELECT 1 FROM empresas e WHERE e.id = ra.empresa_id AND e.responsavel_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = ra.empresa_id AND eu.user_id = auth.uid())
    )
  ))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role) AND EXISTS (
    SELECT 1 FROM reajustes_anuais ra
    WHERE ra.id = reajuste_faixas.reajuste_id AND (
      EXISTS (SELECT 1 FROM empresas e WHERE e.id = ra.empresa_id AND e.responsavel_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = ra.empresa_id AND eu.user_id = auth.uid())
    )
  ));

DROP POLICY IF EXISTS "Administradoras manage implantacoes" ON public.implantacoes_contratos;
CREATE POLICY "Administradoras manage implantacoes" ON public.implantacoes_contratos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

DROP POLICY IF EXISTS "Administradoras manage impl anexos" ON public.implantacao_anexos;
CREATE POLICY "Administradoras manage impl anexos" ON public.implantacao_anexos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

DROP POLICY IF EXISTS "Administradoras insert impl logs" ON public.implantacao_logs;
CREATE POLICY "Administradoras insert impl logs" ON public.implantacao_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

DROP POLICY IF EXISTS "Administradoras manage impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Administradoras manage impl alertas" ON public.implantacao_alertas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role)
    AND (destinatario_role = 'administradoras' OR destinatario_role = 'comum')
    AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role)
    AND (destinatario_role = 'administradoras' OR destinatario_role = 'comum')
    AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid()));

DROP POLICY IF EXISTS "Administradoras insert empresas" ON public.empresas;
CREATE POLICY "Administradoras insert empresas" ON public.empresas
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

DROP POLICY IF EXISTS "Administradoras update empresas" ON public.empresas;
CREATE POLICY "Administradoras update empresas" ON public.empresas
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'administradoras'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

-- 2) Remove overly permissive WITH CHECK (true) INSERT policies.
-- These tables are populated exclusively by SECURITY DEFINER backend functions
-- (adicionar/remover_contrato_grupo, finalizar_implantacao_cadastro), which
-- bypass RLS via the function owner. Direct client inserts should be denied.
DROP POLICY IF EXISTS "Authenticated insert gfa" ON public.grupos_financeiros_auditoria;
DROP POLICY IF EXISTS "Sistema insere historico" ON public.empresa_implantacao_historico;
