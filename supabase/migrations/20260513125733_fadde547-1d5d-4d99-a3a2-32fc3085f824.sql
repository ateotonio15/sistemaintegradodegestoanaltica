
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.implantacao_status AS ENUM ('em_implantacao','aguardando_documentos','em_validacao','implantado','pendente_ajuste');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.implantacoes_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  status public.implantacao_status NOT NULL DEFAULT 'em_implantacao',
  etapa_atual smallint NOT NULL DEFAULT 1,
  -- extracted
  nome_empresa text,
  cnpj text,
  telefone text,
  inscricao_municipal text,
  inscricao_estadual text,
  endereco text,
  cep text,
  grupo_contrato text,
  valor_enfermaria_centavos bigint,
  valor_apartamento_centavos bigint,
  inicio_atendimento date,
  -- contractual
  data_vigencia date,
  data_vencimento date,
  dia_movimentacao integer,
  ticket text,
  modalidade text,
  acomodacao text,
  corretora text,
  codigo_contrato text,
  -- commission
  percentual_agenciamento numeric,
  percentual_vitalicio numeric,
  -- lives
  total_vidas integer,
  faixas_etarias jsonb,
  -- audit
  created_by uuid,
  created_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impl_status ON public.implantacoes_contratos(status);
CREATE INDEX IF NOT EXISTS idx_impl_empresa ON public.implantacoes_contratos(empresa_id);

CREATE TRIGGER trg_impl_updated BEFORE UPDATE ON public.implantacoes_contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.implantacoes_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage implantacoes" ON public.implantacoes_contratos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Comum manage implantacoes" ON public.implantacoes_contratos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'comum'::app_role))
  WITH CHECK (has_role(auth.uid(),'comum'::app_role));

CREATE POLICY "Visualizacao read implantacoes" ON public.implantacoes_contratos
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'visualizacao'::app_role) OR has_role(auth.uid(),'diretora'::app_role));

-- Anexos
CREATE TABLE IF NOT EXISTS public.implantacao_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'complementar',
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impl_anexos_impl ON public.implantacao_anexos(implantacao_id);
ALTER TABLE public.implantacao_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage impl anexos" ON public.implantacao_anexos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Comum manage impl anexos" ON public.implantacao_anexos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'comum'::app_role))
  WITH CHECK (has_role(auth.uid(),'comum'::app_role));

CREATE POLICY "Auth read impl anexos" ON public.implantacao_anexos
  FOR SELECT TO authenticated USING (true);

-- Logs
CREATE TABLE IF NOT EXISTS public.implantacao_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id uuid NOT NULL,
  acao text NOT NULL,
  detalhes jsonb,
  user_id uuid,
  user_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impl_logs_impl ON public.implantacao_logs(implantacao_id);
ALTER TABLE public.implantacao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read impl logs" ON public.implantacao_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Comum insert impl logs" ON public.implantacao_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'comum'::app_role));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('anexos-implantacao','anexos-implantacao', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth read anexos-implantacao" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'anexos-implantacao');

CREATE POLICY "Admin/Comum write anexos-implantacao" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anexos-implantacao' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'comum'::app_role)));

CREATE POLICY "Admin/Comum update anexos-implantacao" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'anexos-implantacao' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'comum'::app_role)));

CREATE POLICY "Admin/Comum delete anexos-implantacao" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'anexos-implantacao' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'comum'::app_role)));
