CREATE TABLE public.movimentacao_email_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id uuid NOT NULL,
  movimentacao_id uuid NOT NULL,
  empresa_id uuid,
  empresa_nome text,
  contrato text,
  competencia text,
  periodo text,
  cenario_sugerido text NOT NULL,
  cenario text NOT NULL,
  modelo text NOT NULL,
  destinatarios text NOT NULL,
  cc text,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  usuario_id uuid,
  usuario_nome text,
  justificativa text,
  motivo_alteracao text,
  assunto text NOT NULL,
  corpo text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.movimentacao_email_envios TO authenticated;
GRANT ALL ON public.movimentacao_email_envios TO service_role;
CREATE INDEX ON public.movimentacao_email_envios (movimentacao_id, enviado_em);
ALTER TABLE public.movimentacao_email_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ler envios de movimentações visíveis" ON public.movimentacao_email_envios
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id = movimentacao_id));