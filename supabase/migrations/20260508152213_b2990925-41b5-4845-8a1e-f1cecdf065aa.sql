ALTER TABLE public.anexos_financeiro ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'normal';
CREATE INDEX IF NOT EXISTS idx_anexos_financeiro_origem ON public.anexos_financeiro(origem);