
-- Tabela principal
CREATE TABLE public.financeiro_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  competencia text NOT NULL, -- formato YYYY-MM
  categoria text NOT NULL,   -- Boletos, Notas Fiscais, Contratos, Excel Financeiro, PDF Financeiro, Comprovantes, Inclusões, Exclusões, Outros
  nome_original text NOT NULL,
  nome_armazenado text NOT NULL,
  extensao text,
  mime_type text,
  tamanho_bytes bigint,
  hash_arquivo text,
  observacao text,
  uploaded_by uuid,
  uploaded_by_nome text,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'ativo', -- ativo | substituido | removido
  versao int NOT NULL DEFAULT 1,
  versao_de uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fin_arq_empresa_comp ON public.financeiro_arquivos (empresa_id, competencia);
CREATE INDEX idx_fin_arq_hash ON public.financeiro_arquivos (hash_arquivo);
CREATE INDEX idx_fin_arq_uploader ON public.financeiro_arquivos (uploaded_by);
CREATE INDEX idx_fin_arq_categoria ON public.financeiro_arquivos (categoria);
CREATE INDEX idx_fin_arq_status ON public.financeiro_arquivos (status);

-- Evita duplicidade ativa por escopo
CREATE UNIQUE INDEX uniq_fin_arq_ativo
  ON public.financeiro_arquivos (empresa_id, competencia, hash_arquivo)
  WHERE status = 'ativo' AND hash_arquivo IS NOT NULL;

ALTER TABLE public.financeiro_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage financeiro_arquivos"
  ON public.financeiro_arquivos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro manage financeiro_arquivos"
  ON public.financeiro_arquivos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE TRIGGER trg_fin_arq_updated_at
  BEFORE UPDATE ON public.financeiro_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('arquivos-financeiro', 'arquivos-financeiro', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (Admin + Financeiro)
CREATE POLICY "Admin read arquivos-financeiro"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'arquivos-financeiro' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin insert arquivos-financeiro"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'arquivos-financeiro' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update arquivos-financeiro"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'arquivos-financeiro' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete arquivos-financeiro"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'arquivos-financeiro' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro read arquivos-financeiro"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'arquivos-financeiro' AND has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Financeiro insert arquivos-financeiro"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'arquivos-financeiro' AND has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Financeiro update arquivos-financeiro"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'arquivos-financeiro' AND has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Financeiro delete arquivos-financeiro"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'arquivos-financeiro' AND has_role(auth.uid(), 'financeiro'::app_role));
