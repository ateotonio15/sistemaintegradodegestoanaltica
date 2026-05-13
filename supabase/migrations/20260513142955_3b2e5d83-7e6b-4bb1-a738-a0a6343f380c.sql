
ALTER TABLE public.implantacoes_contratos
  ADD COLUMN IF NOT EXISTS ticket_auto_sync boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vidas_titulares integer,
  ADD COLUMN IF NOT EXISTS vidas_dependentes integer,
  ADD COLUMN IF NOT EXISTS relatorio_validacao jsonb;
