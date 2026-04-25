-- ============================================
-- Tabela: financeiro_movimentacoes
-- ============================================
CREATE TABLE public.financeiro_movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  mes_referencia TEXT NOT NULL,
  periodo TEXT NOT NULL,
  tipo_cobranca TEXT,
  data_envio_nota DATE,
  dentro_prazo BOOLEAN NOT NULL DEFAULT true,
  cobranca_registrada BOOLEAN NOT NULL DEFAULT false,
  responsavel TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, mes_referencia, periodo)
);

CREATE INDEX idx_fin_mov_mes ON public.financeiro_movimentacoes(mes_referencia);
CREATE INDEX idx_fin_mov_empresa ON public.financeiro_movimentacoes(empresa_id);

ALTER TABLE public.financeiro_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read financeiro_movimentacoes"
  ON public.financeiro_movimentacoes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin manage financeiro_movimentacoes"
  ON public.financeiro_movimentacoes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_financeiro_movimentacoes_updated_at
  BEFORE UPDATE ON public.financeiro_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Tabela: cobrancas
-- ============================================
CREATE TABLE public.cobrancas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  financeiro_movimentacao_id UUID NOT NULL REFERENCES public.financeiro_movimentacoes(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  data DATE NOT NULL,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobrancas_mov ON public.cobrancas(financeiro_movimentacao_id);
CREATE INDEX idx_cobrancas_status ON public.cobrancas(status);

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read cobrancas"
  ON public.cobrancas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin manage cobrancas"
  ON public.cobrancas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cobrancas_updated_at
  BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Tabela: anexos_financeiro
-- ============================================
CREATE TABLE public.anexos_financeiro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  financeiro_movimentacao_id UUID NOT NULL REFERENCES public.financeiro_movimentacoes(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_anexos_fin_mov ON public.anexos_financeiro(financeiro_movimentacao_id);

ALTER TABLE public.anexos_financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read anexos_financeiro"
  ON public.anexos_financeiro FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin manage anexos_financeiro"
  ON public.anexos_financeiro FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- Storage bucket privado
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos-financeiro', 'anexos-financeiro', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read anexos-financeiro storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'anexos-financeiro');

CREATE POLICY "Admin upload anexos-financeiro storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'anexos-financeiro' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update anexos-financeiro storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'anexos-financeiro' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete anexos-financeiro storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'anexos-financeiro' AND has_role(auth.uid(), 'admin'::app_role));