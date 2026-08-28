ALTER TABLE public.cobrancas_retroativas
  ADD COLUMN IF NOT EXISTS origem_retroativo text;

ALTER TABLE public.cobrancas_retroativas
  DROP CONSTRAINT IF EXISTS cobrancas_retroativas_origem_retroativo_check;

ALTER TABLE public.cobrancas_retroativas
  ADD CONSTRAINT cobrancas_retroativas_origem_retroativo_check
  CHECK (origem_retroativo IS NULL OR origem_retroativo IN ('reajuste','beneficiarios'));

UPDATE public.cobrancas_retroativas
SET origem_retroativo = CASE WHEN tipo = 'devolucao' THEN 'beneficiarios' ELSE 'reajuste' END
WHERE origem_retroativo IS NULL;