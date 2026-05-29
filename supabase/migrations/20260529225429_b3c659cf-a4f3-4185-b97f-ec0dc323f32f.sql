
-- Cabeçalho de cada execução de análise em lote por competência/período
CREATE TABLE public.financeiro_analise_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia text NOT NULL,
  periodo text NOT NULL,
  executado_por uuid,
  executado_por_nome text,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  finalizada_em timestamptz,
  status text NOT NULL DEFAULT 'em_andamento',
  total integer NOT NULL DEFAULT 0,
  ok integer NOT NULL DEFAULT 0,
  divergentes integer NOT NULL DEFAULT 0,
  sem_excel integer NOT NULL DEFAULT 0,
  sem_pdf integer NOT NULL DEFAULT 0,
  sem_ambos integer NOT NULL DEFAULT 0,
  erro_leitura integer NOT NULL DEFAULT 0,
  aguardando_faturamento integer NOT NULL DEFAULT 0,
  sem_movimentacao integer NOT NULL DEFAULT 0,
  valor_total_analisado numeric NOT NULL DEFAULT 0,
  valor_total_divergente numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_analise_execucoes TO authenticated;
GRANT ALL ON public.financeiro_analise_execucoes TO service_role;

ALTER TABLE public.financeiro_analise_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage execucoes"
  ON public.financeiro_analise_execucoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro manage execucoes"
  ON public.financeiro_analise_execucoes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Internal roles read execucoes"
  ON public.financeiro_analise_execucoes FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'visualizacao'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
  );

CREATE INDEX idx_fae_mes_periodo ON public.financeiro_analise_execucoes (mes_referencia, periodo, iniciada_em DESC);

-- Itens (1 linha por contrato/pagador analisado)
CREATE TABLE public.financeiro_analise_execucao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.financeiro_analise_execucoes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  financeiro_movimentacao_id uuid,
  pagador_id uuid,
  pagador_nome text,
  pagador_cnpj text,
  empresa_nome text,
  empresa_cnpj text,
  empresa_codigo text,
  mes_referencia text NOT NULL,
  periodo text NOT NULL,
  status text NOT NULL,
  excel_encontrado boolean NOT NULL DEFAULT false,
  pdf_encontrado boolean NOT NULL DEFAULT false,
  comparado boolean NOT NULL DEFAULT false,
  valor_excel numeric,
  valor_pdf numeric,
  diferenca numeric,
  divergencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  erros jsonb NOT NULL DEFAULT '[]'::jsonb,
  proxima_acao text,
  nome_arquivo_excel text,
  nome_arquivo_pdf text,
  hash_excel text,
  hash_pdf text,
  resultado_completo jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_analise_execucao_itens TO authenticated;
GRANT ALL ON public.financeiro_analise_execucao_itens TO service_role;

ALTER TABLE public.financeiro_analise_execucao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage execucao itens"
  ON public.financeiro_analise_execucao_itens FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro manage execucao itens"
  ON public.financeiro_analise_execucao_itens FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Internal roles read execucao itens"
  ON public.financeiro_analise_execucao_itens FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'visualizacao'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
  );

CREATE INDEX idx_faei_execucao ON public.financeiro_analise_execucao_itens (execucao_id);
CREATE INDEX idx_faei_status ON public.financeiro_analise_execucao_itens (execucao_id, status);

CREATE TRIGGER update_fae_updated_at
  BEFORE UPDATE ON public.financeiro_analise_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
