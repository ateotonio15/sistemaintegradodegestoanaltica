-- 1. Novos campos de acionamento em demandas
ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS rh TEXT,
  ADD COLUMN IF NOT EXISTS corretora TEXT,
  ADD COLUMN IF NOT EXISTS colaborador TEXT,
  ADD COLUMN IF NOT EXISTS hora_acionamento TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT;

-- Backfill do status a partir das marcações existentes
UPDATE public.demandas
SET status = CASE
  WHEN resolvido_executiva THEN 'Encerrada'
  WHEN resolvido_setor THEN 'Resolvida'
  WHEN encaminhado_setor THEN 'Encaminhada'
  ELSE 'Aberta'
END
WHERE status IS NULL;

ALTER TABLE public.demandas ALTER COLUMN status SET DEFAULT 'Aberta';

CREATE INDEX IF NOT EXISTS idx_demandas_status ON public.demandas (status);
CREATE INDEX IF NOT EXISTS idx_demandas_data_reclamacao ON public.demandas (data_reclamacao);
CREATE INDEX IF NOT EXISTS idx_demandas_setor ON public.demandas (setor_responsavel);
CREATE INDEX IF NOT EXISTS idx_demandas_empresa ON public.demandas (empresa);

-- 2. Metas / parâmetros dos indicadores
CREATE TABLE IF NOT EXISTS public.indicador_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'pct',
  direcao TEXT NOT NULL DEFAULT 'maior_melhor',
  meta NUMERIC NOT NULL,
  atencao NUMERIC NOT NULL,
  critico NUMERIC NOT NULL,
  descricao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicador_metas TO authenticated;
GRANT ALL ON public.indicador_metas TO service_role;

ALTER TABLE public.indicador_metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metas_select_auth" ON public.indicador_metas;
CREATE POLICY "metas_select_auth" ON public.indicador_metas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "metas_write_admin" ON public.indicador_metas;
CREATE POLICY "metas_write_admin" ON public.indicador_metas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.indicador_metas (indicador, label, unidade, direcao, meta, atencao, critico, descricao) VALUES
  ('sla', 'SLA', 'pct', 'maior_melhor', 95, 90, 90, 'Percentual de demandas atendidas dentro do prazo'),
  ('fora_prazo', 'Fora do prazo', 'pct', 'menor_melhor', 8, 12, 12, 'Percentual de demandas fora do prazo'),
  ('backlog', 'Backlog', 'qtd', 'menor_melhor', 40, 60, 60, 'Quantidade de demandas em aberto'),
  ('tma', 'Tempo médio de resposta', 'horas', 'menor_melhor', 24, 48, 48, 'Tempo médio até a resolução em horas úteis'),
  ('resolutividade', 'Resolutividade', 'pct', 'maior_melhor', 90, 80, 80, 'Percentual de demandas resolvidas'),
  ('reincidencia', 'Reincidência', 'pct', 'menor_melhor', 10, 20, 20, 'Percentual de clientes com mais de um acionamento no mesmo setor')
ON CONFLICT (indicador) DO NOTHING;