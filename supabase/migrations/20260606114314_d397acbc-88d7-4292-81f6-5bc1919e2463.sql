
ALTER TABLE public.financeiro_movimentacoes
  DROP CONSTRAINT IF EXISTS financeiro_movimentacoes_empresa_id_mes_referencia_periodo_key;

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_movimentacoes_empresa_mes_periodo_tipo_key
  ON public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, tipo_lancamento);

UPDATE public.financeiro_movimentacoes
   SET tipo_lancamento = 'fechamento_periodo', updated_at = now()
 WHERE empresa_id = 'fa628aaf-322a-40e2-aad4-c77ab04abd66'
   AND mes_referencia = '2026-06'
   AND periodo = '25-30'
   AND tipo_lancamento = 'normal';

SELECT public.gerar_primeira_cobranca_financeira('fa628aaf-322a-40e2-aad4-c77ab04abd66'::uuid);
