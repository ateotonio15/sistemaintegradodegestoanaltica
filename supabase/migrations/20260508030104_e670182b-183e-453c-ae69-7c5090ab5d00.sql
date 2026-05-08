
-- Tabelas para Reajuste e Cobrança Retroativa (aba Financeiro)

CREATE TABLE IF NOT EXISTS public.cobrancas_retroativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia text NOT NULL, -- formato YYYY-MM
  valor_centavos bigint NOT NULL CHECK (valor_centavos >= 0),
  descricao text,
  financeiro_movimentacao_id uuid REFERENCES public.financeiro_movimentacoes(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cob_retro_empresa ON public.cobrancas_retroativas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cob_retro_competencia ON public.cobrancas_retroativas(competencia);

CREATE TABLE IF NOT EXISTS public.reajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia text NOT NULL, -- YYYY-MM
  valor_centavos bigint NOT NULL CHECK (valor_centavos >= 0),
  parcelas int NOT NULL CHECK (parcelas >= 1),
  possui_aporte boolean NOT NULL DEFAULT false,
  valor_aporte_centavos bigint CHECK (valor_aporte_centavos IS NULL OR valor_aporte_centavos >= 0),
  parcelas_aporte int CHECK (parcelas_aporte IS NULL OR parcelas_aporte >= 1),
  financeiro_movimentacao_id uuid REFERENCES public.financeiro_movimentacoes(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reajustes_empresa ON public.reajustes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reajustes_competencia ON public.reajustes(competencia);

-- Triggers updated_at
CREATE TRIGGER trg_cob_retro_updated BEFORE UPDATE ON public.cobrancas_retroativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_reajustes_updated BEFORE UPDATE ON public.reajustes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cobrancas_retroativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read cobrancas_retroativas" ON public.cobrancas_retroativas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage cobrancas_retroativas" ON public.cobrancas_retroativas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Financeiro manage cobrancas_retroativas" ON public.cobrancas_retroativas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Authenticated read reajustes" ON public.reajustes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage reajustes" ON public.reajustes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Financeiro manage reajustes" ON public.reajustes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'financeiro'::app_role));
