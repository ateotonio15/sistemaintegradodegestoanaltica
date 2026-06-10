
CREATE TABLE public.uber_corridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  horario time,
  colaborador text NOT NULL,
  origem text,
  destino text,
  motivo text,
  tipo text CHECK (tipo IN ('Ida','Volta','Ida e Volta')),
  empresa text,
  forma_pagamento text,
  responsavel text,
  criado_por text,
  valor numeric(12,2) DEFAULT 0,
  reembolso numeric(12,2) DEFAULT 0,
  cancelada boolean NOT NULL DEFAULT false,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uber_corridas_data ON public.uber_corridas(data DESC);
CREATE INDEX idx_uber_corridas_empresa ON public.uber_corridas(empresa);
CREATE INDEX idx_uber_corridas_colaborador ON public.uber_corridas(colaborador);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uber_corridas TO authenticated;
GRANT ALL ON public.uber_corridas TO service_role;

ALTER TABLE public.uber_corridas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view uber_corridas"
  ON public.uber_corridas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage uber_corridas insert"
  ON public.uber_corridas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins manage uber_corridas update"
  ON public.uber_corridas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins manage uber_corridas delete"
  ON public.uber_corridas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_uber_corridas_updated_at
  BEFORE UPDATE ON public.uber_corridas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.uber_corridas;
