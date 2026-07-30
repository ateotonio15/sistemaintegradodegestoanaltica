CREATE TABLE public.sinistralidade_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  empresa_nome text,
  periodo date NOT NULL,
  premio_empresa numeric NOT NULL DEFAULT 0,
  premio_continuidade numeric NOT NULL DEFAULT 0,
  sinistro numeric NOT NULL DEFAULT 0,
  premio_total numeric GENERATED ALWAYS AS (premio_empresa + premio_continuidade) STORED,
  sinistralidade numeric GENERATED ALWAYS AS (sinistro / NULLIF(premio_empresa + premio_continuidade, 0)) STORED,
  be_70 numeric GENERATED ALWAYS AS ((premio_empresa + premio_continuidade) * 0.70) STORED,
  distorcao numeric GENERATED ALWAYS AS ((sinistro / NULLIF((premio_empresa + premio_continuidade) * 0.70, 0)) - 1) STORED,
  aporte_financeiro numeric GENERATED ALWAYS AS ((sinistro - (premio_empresa + premio_continuidade) * 0.70) / 0.70) STORED,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, periodo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sinistralidade_mensal TO authenticated;
GRANT ALL ON public.sinistralidade_mensal TO service_role;

ALTER TABLE public.sinistralidade_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sinistralidade_mensal_rw" ON public.sinistralidade_mensal
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'executivo'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'executivo'::app_role));

CREATE INDEX idx_sinistralidade_mensal_periodo ON public.sinistralidade_mensal (periodo DESC);

CREATE TRIGGER sinistralidade_mensal_set_updated
BEFORE UPDATE ON public.sinistralidade_mensal
FOR EACH ROW EXECUTE FUNCTION public.cs_set_updated_at();