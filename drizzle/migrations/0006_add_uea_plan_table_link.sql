ALTER TABLE public.uea_titulares
  ADD COLUMN IF NOT EXISTS plano text,
  ADD COLUMN IF NOT EXISTS faixa_sequencia text;

ALTER TABLE public.uea_dependentes
  ADD COLUMN IF NOT EXISTS plano text,
  ADD COLUMN IF NOT EXISTS faixa_sequencia text;

COMMENT ON COLUMN public.uea_titulares.plano IS 'Plano informado no Layout de Vidas';
COMMENT ON COLUMN public.uea_titulares.faixa_sequencia IS 'Sequência da tabela de faixas aplicável';
COMMENT ON COLUMN public.uea_dependentes.plano IS 'Plano informado no Layout de Vidas';
COMMENT ON COLUMN public.uea_dependentes.faixa_sequencia IS 'Sequência da tabela de faixas aplicável';