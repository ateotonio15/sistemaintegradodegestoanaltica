DROP INDEX IF EXISTS public.movimentacoes_empresa_mes_periodo_uniq;
ALTER TABLE public.movimentacoes
  ADD CONSTRAINT movimentacoes_empresa_mes_periodo_uniq
  UNIQUE (empresa_id, mes_referencia, periodo);