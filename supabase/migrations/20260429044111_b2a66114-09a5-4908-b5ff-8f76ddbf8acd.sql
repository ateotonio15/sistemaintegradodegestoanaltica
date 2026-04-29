
CREATE TABLE public.a_receber (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  financeiro_movimentacao_id uuid NOT NULL UNIQUE,
  empresa_id uuid NOT NULL,
  empresa_nome text NOT NULL,
  empresa_cnpj text,
  valor_total numeric(14,2),
  valor_faturado numeric(14,2),
  valor_inclusoes numeric(14,2),
  valor_exclusoes numeric(14,2),
  beneficiarios integer,
  nf_numero text,
  dia_vencimento smallint,
  data_vencimento date,
  periodo text NOT NULL,
  mes_referencia text NOT NULL,
  status text NOT NULL DEFAULT 'Pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_a_receber_mes ON public.a_receber(mes_referencia);
CREATE INDEX idx_a_receber_periodo ON public.a_receber(periodo);

ALTER TABLE public.a_receber ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage a_receber" ON public.a_receber
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro manage a_receber" ON public.a_receber
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Authenticated read a_receber" ON public.a_receber
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_a_receber_updated_at
  BEFORE UPDATE ON public.a_receber
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
