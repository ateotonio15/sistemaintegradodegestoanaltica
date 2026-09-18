ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS vencimento_competencia TEXT NOT NULL DEFAULT 'atual';

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_vencimento_competencia_check
  CHECK (vencimento_competencia IN ('anterior','atual','posterior'));