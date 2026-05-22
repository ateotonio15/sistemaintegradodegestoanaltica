-- ============ FINANCEIRO ============
DROP POLICY IF EXISTS "Authenticated read anexos_financeiro" ON public.anexos_financeiro;
CREATE POLICY "Internal roles read anexos_financeiro" ON public.anexos_financeiro
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read cobrancas" ON public.cobrancas;
CREATE POLICY "Internal roles read cobrancas" ON public.cobrancas
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read cobrancas_retroativas" ON public.cobrancas_retroativas;
CREATE POLICY "Internal roles read cobrancas_retroativas" ON public.cobrancas_retroativas
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read financeiro_analises" ON public.financeiro_analises;
CREATE POLICY "Internal roles read financeiro_analises" ON public.financeiro_analises
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read financeiro_movimentacoes" ON public.financeiro_movimentacoes;
CREATE POLICY "Internal roles read financeiro_movimentacoes" ON public.financeiro_movimentacoes
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role) OR has_role(auth.uid(),'comum'::app_role)
  OR has_role(auth.uid(),'executivo'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read financeiro_pagadores" ON public.financeiro_pagadores;
CREATE POLICY "Internal roles read financeiro_pagadores" ON public.financeiro_pagadores
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read fora_prazo_exclusoes" ON public.fora_prazo_exclusoes;
CREATE POLICY "Internal roles read fora_prazo_exclusoes" ON public.fora_prazo_exclusoes
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role)
);

-- ============ REAJUSTES ============
DROP POLICY IF EXISTS "Authenticated read reajuste_faixas" ON public.reajuste_faixas;
CREATE POLICY "Internal roles read reajuste_faixas" ON public.reajuste_faixas
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role) OR has_role(auth.uid(),'comum'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read reajustes" ON public.reajustes;
CREATE POLICY "Internal roles read reajustes" ON public.reajustes
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role) OR has_role(auth.uid(),'comum'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read reajustes_anuais" ON public.reajustes_anuais;
CREATE POLICY "Internal roles read reajustes_anuais" ON public.reajustes_anuais
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role) OR has_role(auth.uid(),'comum'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read alertas_reajuste" ON public.alertas_reajuste;
CREATE POLICY "Scoped read alertas_reajuste" ON public.alertas_reajuste
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role)
  OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR destinatario_user_id = auth.uid() OR criado_por_user_id = auth.uid()
);

-- ============ ANEXOS / SUSPENSOES / EMPRESAS ============
DROP POLICY IF EXISTS "Authenticated read anexos_movimentacao" ON public.anexos_movimentacao;
CREATE POLICY "Internal roles read anexos_movimentacao" ON public.anexos_movimentacao
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role) OR has_role(auth.uid(),'comum'::app_role)
  OR has_role(auth.uid(),'executivo'::app_role)
);

DROP POLICY IF EXISTS "Authenticated read empresa_suspensoes" ON public.empresa_suspensoes;
CREATE POLICY "Internal roles read empresa_suspensoes" ON public.empresa_suspensoes
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role) OR has_role(auth.uid(),'comum'::app_role)
  OR has_role(auth.uid(),'executivo'::app_role)
);

DROP POLICY IF EXISTS "Authenticated users view all empresas" ON public.empresas;
CREATE POLICY "Comum view empresas" ON public.empresas FOR SELECT TO authenticated USING (has_role(auth.uid(),'comum'::app_role));
CREATE POLICY "Financeiro view empresas" ON public.empresas FOR SELECT TO authenticated USING (has_role(auth.uid(),'financeiro'::app_role));
CREATE POLICY "Enfermeira view empresas" ON public.empresas FOR SELECT TO authenticated USING (has_role(auth.uid(),'enfermeira'::app_role));
CREATE POLICY "Vendas view empresas" ON public.empresas FOR SELECT TO authenticated USING (has_role(auth.uid(),'vendas'::app_role));

-- ============ IMPLANTACAO ============
DROP POLICY IF EXISTS "Auth read impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Scoped read impl alertas" ON public.implantacao_alertas
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role)
  OR has_role(auth.uid(),'visualizacao'::app_role) OR has_role(auth.uid(),'administradoras'::app_role)
  OR (has_role(auth.uid(),'comum'::app_role) AND destinatario_role = 'comum' AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid()))
  OR (has_role(auth.uid(),'vendas'::app_role) AND (destinatario_role = 'vendas' OR criado_por = auth.uid()))
);

DROP POLICY IF EXISTS "Auth read impl anexos" ON public.implantacao_anexos;
CREATE POLICY "Scoped read impl anexos" ON public.implantacao_anexos
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role)
  OR has_role(auth.uid(),'visualizacao'::app_role) OR has_role(auth.uid(),'administradoras'::app_role)
  OR has_role(auth.uid(),'comum'::app_role)
  OR (has_role(auth.uid(),'vendas'::app_role) AND EXISTS (
    SELECT 1 FROM public.implantacoes_contratos ic
    WHERE ic.id = implantacao_anexos.implantacao_id AND ic.created_by = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Auth read impl logs" ON public.implantacao_logs;
CREATE POLICY "Scoped read impl logs" ON public.implantacao_logs
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role)
  OR has_role(auth.uid(),'visualizacao'::app_role) OR has_role(auth.uid(),'administradoras'::app_role)
  OR has_role(auth.uid(),'comum'::app_role) OR has_role(auth.uid(),'vendas'::app_role)
);

-- ============ NOTIFICACOES ============
DROP POLICY IF EXISTS "Authenticated read notificacoes" ON public.notificacoes;
CREATE POLICY "Internal roles read notificacoes" ON public.notificacoes
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
  OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'visualizacao'::app_role)
  OR has_role(auth.uid(),'administradoras'::app_role) OR has_role(auth.uid(),'comum'::app_role)
  OR has_role(auth.uid(),'executivo'::app_role) OR has_role(auth.uid(),'vendas'::app_role)
  OR has_role(auth.uid(),'enfermeira'::app_role)
);