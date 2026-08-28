ALTER TABLE public.cobrancas_retroativas ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'retroativa';

COMMENT ON COLUMN public.cobrancas_retroativas.tipo IS 'retroativa ou devolucao';
