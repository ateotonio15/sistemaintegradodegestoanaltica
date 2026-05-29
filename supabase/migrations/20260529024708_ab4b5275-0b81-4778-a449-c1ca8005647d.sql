ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS exige_po_pc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_financeiro_cliente text,
  ADD COLUMN IF NOT EXISTS observacao_padrao_financeiro text,
  ADD COLUMN IF NOT EXISTS regra_prorrogacao text,
  ADD COLUMN IF NOT EXISTS exige_relatorio_antes_nota boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS config_financeira_confirmada boolean NOT NULL DEFAULT false;