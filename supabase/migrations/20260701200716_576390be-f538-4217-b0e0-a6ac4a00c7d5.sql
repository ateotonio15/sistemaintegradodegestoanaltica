
-- Palestras de saúde e bloqueios de agenda
CREATE TYPE public.palestra_status AS ENUM ('a_confirmar','confirmado','concluido','cancelado');
CREATE TYPE public.bloqueio_periodo AS ENUM ('dia_todo','manha','tarde');

CREATE TABLE public.palestras_saude (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  endereco TEXT NOT NULL,
  data DATE NOT NULL,
  horario_inicio TIME,
  horario_fim TIME,
  tema TEXT,
  observacao TEXT,
  status public.palestra_status NOT NULL DEFAULT 'a_confirmar',
  motivo_cancelamento TEXT,
  executiva_user_id UUID,
  executiva_nome TEXT,
  created_by UUID,
  created_by_nome TEXT,
  updated_by UUID,
  updated_by_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.palestras_saude TO authenticated;
GRANT ALL ON public.palestras_saude TO service_role;
ALTER TABLE public.palestras_saude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Palestras: leitura autenticada"
  ON public.palestras_saude FOR SELECT TO authenticated USING (true);
CREATE POLICY "Palestras: escrita saude/exec"
  ON public.palestras_saude FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'executivo') OR
    public.has_role(auth.uid(),'enfermeira') OR
    public.has_role(auth.uid(),'diretora')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'executivo') OR
    public.has_role(auth.uid(),'enfermeira') OR
    public.has_role(auth.uid(),'diretora')
  );

CREATE INDEX idx_palestras_data ON public.palestras_saude(data);
CREATE INDEX idx_palestras_empresa ON public.palestras_saude(empresa_id);

CREATE TRIGGER trg_palestras_updated_at
  BEFORE UPDATE ON public.palestras_saude
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.palestras_bloqueios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  periodo public.bloqueio_periodo NOT NULL DEFAULT 'dia_todo',
  motivo TEXT NOT NULL,
  created_by UUID,
  created_by_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.palestras_bloqueios TO authenticated;
GRANT ALL ON public.palestras_bloqueios TO service_role;
ALTER TABLE public.palestras_bloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bloqueios: leitura autenticada"
  ON public.palestras_bloqueios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Bloqueios: escrita saude/exec"
  ON public.palestras_bloqueios FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'executivo') OR
    public.has_role(auth.uid(),'enfermeira') OR
    public.has_role(auth.uid(),'diretora')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'executivo') OR
    public.has_role(auth.uid(),'enfermeira') OR
    public.has_role(auth.uid(),'diretora')
  );

CREATE INDEX idx_bloqueios_data ON public.palestras_bloqueios(data);

CREATE TRIGGER trg_bloqueios_updated_at
  BEFORE UPDATE ON public.palestras_bloqueios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.palestras_saude;
ALTER PUBLICATION supabase_realtime ADD TABLE public.palestras_bloqueios;
