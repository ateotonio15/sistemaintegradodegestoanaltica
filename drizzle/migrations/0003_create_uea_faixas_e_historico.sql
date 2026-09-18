-- Faixas etárias configuráveis do módulo Dependentes UEA
CREATE TABLE public.uea_faixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idade_inicial INTEGER NOT NULL,
  idade_final INTEGER,
  valor_mensal NUMERIC(12,2) NOT NULL DEFAULT 0,
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uea_faixas TO authenticated;
GRANT ALL ON public.uea_faixas TO service_role;

ALTER TABLE public.uea_faixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uea_faixas_admin_all" ON public.uea_faixas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_uea_faixas_updated_at
  BEFORE UPDATE ON public.uea_faixas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de mudanças de faixa/valor dos dependentes
CREATE TABLE public.uea_dependente_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dependente_id UUID NOT NULL REFERENCES public.uea_dependentes(id) ON DELETE CASCADE,
  faixa_anterior TEXT,
  faixa_nova TEXT,
  valor_anterior NUMERIC(12,2),
  valor_novo NUMERIC(12,2),
  motivo TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uea_dep_hist_dependente ON public.uea_dependente_historico(dependente_id, created_at DESC);

GRANT SELECT, INSERT ON public.uea_dependente_historico TO authenticated;
GRANT ALL ON public.uea_dependente_historico TO service_role;

ALTER TABLE public.uea_dependente_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uea_dep_hist_admin_all" ON public.uea_dependente_historico
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));