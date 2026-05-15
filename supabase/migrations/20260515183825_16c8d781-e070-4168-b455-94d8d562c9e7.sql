
CREATE TABLE IF NOT EXISTS public.financeiro_analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  financeiro_movimentacao_id uuid,
  mes_referencia text NOT NULL,
  periodo text NOT NULL,
  pagador_nome text,
  pagador_cnpj text,
  tipo_analise text,
  status_analise text NOT NULL DEFAULT 'PENDENTE'
    CHECK (status_analise IN ('OK','ERRO','PENDENTE')),
  nome_arquivo_excel text,
  nome_arquivo_pdf text,
  hash_excel text,
  hash_pdf text,
  valor_excel_apartamento numeric,
  valor_pdf_apartamento numeric,
  valor_excel_enfermaria numeric,
  valor_pdf_enfermaria numeric,
  valor_excel_inclusoes numeric,
  valor_pdf_inclusoes numeric,
  valor_excel_exclusoes numeric,
  valor_pdf_exclusoes numeric,
  qtd_excel_apartamento integer,
  qtd_pdf_apartamento integer,
  qtd_excel_enfermaria integer,
  qtd_pdf_enfermaria integer,
  divergencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  resultado_completo jsonb,
  mensagem_final text,
  analisado_por uuid,
  analisado_por_nome text,
  data_analise timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_analises_unique_chave
  ON public.financeiro_analises (
    empresa_id,
    mes_referencia,
    periodo,
    COALESCE(pagador_cnpj,''),
    COALESCE(pagador_nome,'')
  );

CREATE INDEX IF NOT EXISTS financeiro_analises_lookup_idx
  ON public.financeiro_analises (empresa_id, mes_referencia, periodo);

CREATE INDEX IF NOT EXISTS financeiro_analises_hash_idx
  ON public.financeiro_analises (empresa_id, mes_referencia, periodo, hash_excel, hash_pdf);

CREATE INDEX IF NOT EXISTS financeiro_analises_status_mes_idx
  ON public.financeiro_analises (mes_referencia, status_analise);

ALTER TABLE public.financeiro_analises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage financeiro_analises"
  ON public.financeiro_analises
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro manage financeiro_analises"
  ON public.financeiro_analises
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Authenticated read financeiro_analises"
  ON public.financeiro_analises
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_financeiro_analises_updated_at
  BEFORE UPDATE ON public.financeiro_analises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
