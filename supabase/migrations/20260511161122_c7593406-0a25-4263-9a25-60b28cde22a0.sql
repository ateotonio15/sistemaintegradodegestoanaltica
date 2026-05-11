-- Tabela de reajustes anuais contratuais
CREATE TABLE public.reajustes_anuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ano integer NOT NULL,
  valor_antigo_centavos bigint NOT NULL,
  percentual numeric(6,2) NOT NULL,
  valor_reajustado_centavos bigint NOT NULL,
  data_aplicacao date NOT NULL,
  observacao text,
  status text NOT NULL DEFAULT 'Reajustado',
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ano)
);

CREATE INDEX idx_reajustes_anuais_empresa ON public.reajustes_anuais(empresa_id);
CREATE INDEX idx_reajustes_anuais_ano ON public.reajustes_anuais(ano);

ALTER TABLE public.reajustes_anuais ENABLE ROW LEVEL SECURITY;

-- SELECT: todos autenticados
CREATE POLICY "Authenticated read reajustes_anuais"
  ON public.reajustes_anuais FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: admin e visualizacao
CREATE POLICY "Admin manage reajustes_anuais"
  ON public.reajustes_anuais FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Visualizacao manage reajustes_anuais"
  ON public.reajustes_anuais FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'visualizacao'::app_role))
  WITH CHECK (has_role(auth.uid(), 'visualizacao'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_reajustes_anuais_updated_at
  BEFORE UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();