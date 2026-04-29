ALTER TABLE public.financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS tipo_analise text NOT NULL DEFAULT 'normal';

ALTER TABLE public.financeiro_movimentacoes
  DROP CONSTRAINT IF EXISTS chk_tipo_analise;

ALTER TABLE public.financeiro_movimentacoes
  ADD CONSTRAINT chk_tipo_analise
  CHECK (tipo_analise IN ('normal','faixa_etaria','moto_honda'));