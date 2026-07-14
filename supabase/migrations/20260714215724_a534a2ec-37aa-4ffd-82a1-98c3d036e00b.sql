
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS portal_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS portal_secoes jsonb NOT NULL DEFAULT '{"contrato":true,"vidas":true,"movimentacoes":true,"chat":true}'::jsonb;
