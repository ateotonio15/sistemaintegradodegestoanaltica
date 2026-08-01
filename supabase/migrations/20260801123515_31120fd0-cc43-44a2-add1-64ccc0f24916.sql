CREATE TABLE public.cs_carteira_config (
  empresa_id uuid PRIMARY KEY,
  meta_sinistralidade numeric NOT NULL DEFAULT 0.70,
  usa_in_company boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_carteira_config TO authenticated;
GRANT ALL ON public.cs_carteira_config TO service_role;

ALTER TABLE public.cs_carteira_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_carteira_config_rw" ON public.cs_carteira_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'executivo'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR has_role(auth.uid(),'executivo'::app_role));

CREATE TRIGGER cs_carteira_config_set_updated BEFORE UPDATE ON public.cs_carteira_config
  FOR EACH ROW EXECUTE FUNCTION public.cs_set_updated_at();

ALTER TABLE public.sinistralidade_mensal
  ADD COLUMN meta_sinistralidade numeric NOT NULL DEFAULT 0.70,
  ADD COLUMN hm_in_company numeric NOT NULL DEFAULT 0,
  ADD COLUMN fisioterapia_in_company numeric NOT NULL DEFAULT 0,
  ADD COLUMN administrativo_in_company numeric NOT NULL DEFAULT 0;

ALTER TABLE public.sinistralidade_mensal
  DROP COLUMN sinistralidade,
  DROP COLUMN be_70,
  DROP COLUMN distorcao,
  DROP COLUMN aporte_financeiro;

ALTER TABLE public.sinistralidade_mensal
  ADD COLUMN sinistro_total numeric GENERATED ALWAYS AS (sinistro + hm_in_company + fisioterapia_in_company + administrativo_in_company) STORED,
  ADD COLUMN sinistralidade numeric GENERATED ALWAYS AS ((sinistro + hm_in_company + fisioterapia_in_company + administrativo_in_company) / NULLIF(premio_empresa + premio_continuidade, 0)) STORED,
  ADD COLUMN be_meta numeric GENERATED ALWAYS AS ((premio_empresa + premio_continuidade) * meta_sinistralidade) STORED,
  ADD COLUMN distorcao numeric GENERATED ALWAYS AS (((sinistro + hm_in_company + fisioterapia_in_company + administrativo_in_company) / NULLIF((premio_empresa + premio_continuidade) * meta_sinistralidade, 0)) - 1) STORED,
  ADD COLUMN aporte_financeiro numeric GENERATED ALWAYS AS (((sinistro + hm_in_company + fisioterapia_in_company + administrativo_in_company) - (premio_empresa + premio_continuidade) * meta_sinistralidade) / NULLIF(meta_sinistralidade, 0)) STORED;