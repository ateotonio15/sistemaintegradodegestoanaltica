
-- 1) financeiro_arquivos: add SELECT for internal read-only roles
CREATE POLICY "Internal roles read financeiro_arquivos"
ON public.financeiro_arquivos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'diretora'::app_role)
  OR public.has_role(auth.uid(), 'visualizacao'::app_role)
  OR public.has_role(auth.uid(), 'administradoras'::app_role)
);

-- 2) implantacao_logs: scope vendas role to their own contracts
DROP POLICY IF EXISTS "Scoped read impl logs" ON public.implantacao_logs;
CREATE POLICY "Scoped read impl logs"
ON public.implantacao_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
  OR public.has_role(auth.uid(), 'visualizacao'::app_role)
  OR public.has_role(auth.uid(), 'administradoras'::app_role)
  OR public.has_role(auth.uid(), 'comum'::app_role)
  OR (
    public.has_role(auth.uid(), 'vendas'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.implantacoes_contratos ic
      WHERE ic.id = implantacao_logs.implantacao_id
        AND ic.created_by = auth.uid()
    )
  )
);

-- 3) realtime.messages: scope channel topics by role
DROP POLICY IF EXISTS "App roles can use realtime" ON realtime.messages;
CREATE POLICY "App roles can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Admins can listen to anything
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    -- Personal notification channel: only the owning user
    realtime.topic() = ('notificacoes-realtime-' || auth.uid()::text)
  )
  OR (
    -- Financial channels: financeiro, diretora
    realtime.topic() IN (
      'alertas-financeiro-realtime',
      'alertas-vencimento-realtime',
      'faturamentos-nao-enviados-realtime'
    )
    AND (
      public.has_role(auth.uid(), 'financeiro'::app_role)
      OR public.has_role(auth.uid(), 'diretora'::app_role)
    )
  )
  OR (
    -- Financeiro per-month channel (financeiro-realtime-YYYY-MM)
    realtime.topic() LIKE 'financeiro-realtime-%'
    AND (
      public.has_role(auth.uid(), 'financeiro'::app_role)
      OR public.has_role(auth.uid(), 'diretora'::app_role)
      OR public.has_role(auth.uid(), 'comum'::app_role)
    )
  )
  OR (
    -- Diretora analysis channel
    realtime.topic() = 'diretora-analise-realtime'
    AND public.has_role(auth.uid(), 'diretora'::app_role)
  )
  OR (
    -- Vendas correction channel
    realtime.topic() = 'vendas-correcao-realtime'
    AND public.has_role(auth.uid(), 'vendas'::app_role)
  )
  OR (
    -- Background job channels (process-job-*) — open to authenticated app users
    realtime.topic() LIKE 'process-job-%'
    AND (
      public.has_role(auth.uid(), 'comum'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR public.has_role(auth.uid(), 'diretora'::app_role)
      OR public.has_role(auth.uid(), 'visualizacao'::app_role)
      OR public.has_role(auth.uid(), 'administradoras'::app_role)
      OR public.has_role(auth.uid(), 'executivo'::app_role)
      OR public.has_role(auth.uid(), 'vendas'::app_role)
    )
  )
  OR (
    -- General app-wide topics (dashboard, empresas, reajustes, implantações em andamento)
    realtime.topic() IN (
      'dashboard-empresas-realtime',
      'empresas-vidas-realtime',
      'reajustes-realtime',
      'alertas-reajuste-banner',
      'impl-andamento-realtime'
    )
    AND (
      public.has_role(auth.uid(), 'comum'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR public.has_role(auth.uid(), 'diretora'::app_role)
      OR public.has_role(auth.uid(), 'visualizacao'::app_role)
      OR public.has_role(auth.uid(), 'administradoras'::app_role)
      OR public.has_role(auth.uid(), 'executivo'::app_role)
      OR public.has_role(auth.uid(), 'vendas'::app_role)
    )
  )
);
