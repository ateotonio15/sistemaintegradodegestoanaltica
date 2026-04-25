-- 1) Novos campos em empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS contrato_faixa_etaria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_suspenso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_suspensao date,
  ADD COLUMN IF NOT EXISTS motivo_suspensao text;

-- 2) Histórico de suspensões
CREATE TABLE IF NOT EXISTS public.empresa_suspensoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date,
  motivo text NOT NULL,
  observacao text,
  suspenso_por uuid,
  reativado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresa_suspensoes_empresa ON public.empresa_suspensoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_suspensoes_aberta
  ON public.empresa_suspensoes(empresa_id) WHERE data_fim IS NULL;

ALTER TABLE public.empresa_suspensoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read empresa_suspensoes" ON public.empresa_suspensoes;
CREATE POLICY "Authenticated read empresa_suspensoes"
  ON public.empresa_suspensoes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage empresa_suspensoes" ON public.empresa_suspensoes;
CREATE POLICY "Admin manage empresa_suspensoes"
  ON public.empresa_suspensoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_empresa_suspensoes_updated_at ON public.empresa_suspensoes;
CREATE TRIGGER trg_empresa_suspensoes_updated_at
  BEFORE UPDATE ON public.empresa_suspensoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();