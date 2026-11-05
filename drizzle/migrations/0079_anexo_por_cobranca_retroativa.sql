ALTER TABLE public.anexos_financeiro ADD COLUMN IF NOT EXISTS cobranca_retroativa_id uuid;
CREATE INDEX IF NOT EXISTS idx_anexos_fin_cobranca_retro ON public.anexos_financeiro(cobranca_retroativa_id);
-- Vincula anexos existentes à cobrança criada logo depois do upload (até 2 min)
UPDATE public.anexos_financeiro a SET cobranca_retroativa_id = c.id
FROM public.cobrancas_retroativas c
WHERE a.origem = 'retroativo' AND a.cobranca_retroativa_id IS NULL
  AND a.financeiro_movimentacao_id = c.financeiro_movimentacao_id
  AND c.created_at >= a.created_at AND c.created_at - a.created_at < interval '2 minutes';