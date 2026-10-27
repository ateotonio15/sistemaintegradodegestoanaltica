CREATE TABLE public.uber_passageiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setor text NOT NULL,
  endereco text NOT NULL,
  whatsapp text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  tem_corrida_padrao boolean NOT NULL DEFAULT false,
  usar_endereco_origem boolean NOT NULL DEFAULT true,
  origem_padrao text,
  tipo_padrao text,
  motivo_padrao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uber_passageiros TO authenticated;
GRANT ALL ON public.uber_passageiros TO service_role;

ALTER TABLE public.uber_passageiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uber_passageiros_role_read"
ON public.uber_passageiros FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Admins manage uber_passageiros insert"
ON public.uber_passageiros FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage uber_passageiros update"
ON public.uber_passageiros FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage uber_passageiros delete"
ON public.uber_passageiros FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Enfermeiras read uber_passageiros"
ON public.uber_passageiros FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'enfermeira'::app_role));

CREATE POLICY "Enfermeiras insert uber_passageiros"
ON public.uber_passageiros FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'enfermeira'::app_role));

CREATE POLICY "Enfermeiras update uber_passageiros"
ON public.uber_passageiros FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'enfermeira'::app_role))
WITH CHECK (has_role(auth.uid(), 'enfermeira'::app_role));

CREATE POLICY "Enfermeiras delete uber_passageiros"
ON public.uber_passageiros FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'enfermeira'::app_role));

CREATE POLICY "Executivos read uber_passageiros"
ON public.uber_passageiros FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executivo'::app_role));

CREATE POLICY "Executivos insert uber_passageiros"
ON public.uber_passageiros FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'executivo'::app_role));

CREATE POLICY "Executivos update uber_passageiros"
ON public.uber_passageiros FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'executivo'::app_role))
WITH CHECK (has_role(auth.uid(), 'executivo'::app_role));

CREATE POLICY "Executivos delete uber_passageiros"
ON public.uber_passageiros FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'executivo'::app_role));

CREATE POLICY "Vendas read uber_passageiros"
ON public.uber_passageiros FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'vendas'::app_role));

ALTER TABLE public.uber_corridas ADD COLUMN passageiro_id uuid;
COMMENT ON COLUMN public.uber_corridas.passageiro_id IS 'Passageiro cadastrado em uber_passageiros. Sem chave estrangeira de propósito: excluir o passageiro não pode apagar nem alterar corridas já registradas (o histórico usa a cópia em colaborador/origem/tipo/motivo).';