
-- 1) Amplia cobrancas_retroativas
ALTER TABLE public.cobrancas_retroativas
  DROP CONSTRAINT IF EXISTS cobrancas_retroativas_valor_centavos_check;

ALTER TABLE public.cobrancas_retroativas
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS tipo_ajuste text NOT NULL DEFAULT 'cobranca',
  ADD COLUMN IF NOT EXISTS valor_total_calculado_centavos bigint,
  ADD COLUMN IF NOT EXISTS valor_total_manual_centavos bigint,
  ADD COLUMN IF NOT EXISTS status_calc text NOT NULL DEFAULT 'rascunho';

ALTER TABLE public.cobrancas_retroativas
  DROP CONSTRAINT IF EXISTS cobrancas_retroativas_tipo_ajuste_check;
ALTER TABLE public.cobrancas_retroativas
  ADD CONSTRAINT cobrancas_retroativas_tipo_ajuste_check
  CHECK (tipo_ajuste IN ('cobranca','devolucao'));

ALTER TABLE public.cobrancas_retroativas
  DROP CONSTRAINT IF EXISTS cobrancas_retroativas_status_calc_check;
ALTER TABLE public.cobrancas_retroativas
  ADD CONSTRAINT cobrancas_retroativas_status_calc_check
  CHECK (status_calc IN ('rascunho','calculado','aguardando_validacao','aprovado','aplicado','cancelado'));

-- 2) Tabela de itens (beneficiários)
CREATE TABLE IF NOT EXISTS public.cobrancas_retroativas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_retroativa_id uuid NOT NULL REFERENCES public.cobrancas_retroativas(id) ON DELETE CASCADE,
  beneficiario_nome text NOT NULL,
  codigo_beneficiario text,
  matricula text,
  tipo_beneficiario text,
  beneficiario_titular text,
  plano_modulo text NOT NULL,
  mensalidade_centavos bigint NOT NULL CHECK (mensalidade_centavos >= 0),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias_proporcionais integer NOT NULL DEFAULT 0,
  valor_calculado_centavos bigint NOT NULL DEFAULT 0,
  valor_final_centavos bigint NOT NULL DEFAULT 0,
  tipo_lancamento text NOT NULL DEFAULT 'cobranca' CHECK (tipo_lancamento IN ('cobranca','devolucao')),
  observacao text,
  alterado_manualmente boolean NOT NULL DEFAULT false,
  usuario_alteracao_id uuid,
  usuario_alteracao_nome text,
  data_alteracao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_cri_cobranca ON public.cobrancas_retroativas_itens(cobranca_retroativa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas_retroativas_itens TO authenticated;
GRANT ALL ON public.cobrancas_retroativas_itens TO service_role;

ALTER TABLE public.cobrancas_retroativas_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage cri" ON public.cobrancas_retroativas_itens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Financeiro manage cri" ON public.cobrancas_retroativas_itens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Internal read cri" ON public.cobrancas_retroativas_itens
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'financeiro'::app_role)
    OR has_role(auth.uid(),'diretora'::app_role)
    OR has_role(auth.uid(),'visualizacao'::app_role)
    OR has_role(auth.uid(),'administradoras'::app_role)
  );

CREATE TRIGGER trg_cri_updated
  BEFORE UPDATE ON public.cobrancas_retroativas_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Tabela de períodos (quebra mensal)
CREATE TABLE IF NOT EXISTS public.cobrancas_retroativas_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.cobrancas_retroativas_itens(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  data_inicio_periodo date NOT NULL,
  data_fim_periodo date NOT NULL,
  dias_mes integer NOT NULL,
  dias_cobrados integer NOT NULL,
  mensalidade_centavos bigint NOT NULL,
  valor_diario_centavos numeric(18,4) NOT NULL,
  valor_calculado_centavos bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crp_item ON public.cobrancas_retroativas_periodos(item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas_retroativas_periodos TO authenticated;
GRANT ALL ON public.cobrancas_retroativas_periodos TO service_role;

ALTER TABLE public.cobrancas_retroativas_periodos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage crp" ON public.cobrancas_retroativas_periodos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Financeiro manage crp" ON public.cobrancas_retroativas_periodos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Internal read crp" ON public.cobrancas_retroativas_periodos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'financeiro'::app_role)
    OR has_role(auth.uid(),'diretora'::app_role)
    OR has_role(auth.uid(),'visualizacao'::app_role)
    OR has_role(auth.uid(),'administradoras'::app_role)
  );
