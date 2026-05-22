
CREATE TABLE public.historicos_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  financeiro_movimentacao_id uuid NOT NULL UNIQUE,
  competencia text NOT NULL,
  periodo text NOT NULL,
  texto_historico text NOT NULL,
  vencimento_utilizado date,
  prorrogado boolean NOT NULL DEFAULT false,
  motivo_prorrogacao text,
  usuario_geracao uuid,
  usuario_geracao_nome text,
  data_geracao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historicos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage historicos_financeiros"
  ON public.historicos_financeiros FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro manage historicos_financeiros"
  ON public.historicos_financeiros FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Internal roles read historicos_financeiros"
  ON public.historicos_financeiros FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'visualizacao'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
  );

CREATE TRIGGER historicos_financeiros_updated_at
  BEFORE UPDATE ON public.historicos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_historicos_financeiros_empresa ON public.historicos_financeiros(empresa_id);
CREATE INDEX idx_historicos_financeiros_comp ON public.historicos_financeiros(competencia, periodo);
