-- Add categoria to saude_agendamentos
ALTER TABLE public.saude_agendamentos
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'palestra';

-- Saude acoes (triagens, biometria)
CREATE TABLE IF NOT EXISTS public.saude_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  enfermeira_user_id uuid NOT NULL,
  data date NOT NULL,
  colaborador_nome text NOT NULL,
  cpf text,
  idade integer,
  sexo text,
  peso numeric(5,2),
  altura numeric(4,2),
  imc numeric(5,2),
  pressao_arterial text,
  glicemia numeric(5,1),
  frequencia_cardiaca integer,
  saturacao integer,
  temperatura numeric(4,1),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saude_acoes TO authenticated;
GRANT ALL ON public.saude_acoes TO service_role;

ALTER TABLE public.saude_acoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Saude acoes select authenticated"
  ON public.saude_acoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Saude acoes insert admin/enfermeira"
  ON public.saude_acoes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'enfermeira')
  );

CREATE POLICY "Saude acoes update admin/enfermeira"
  ON public.saude_acoes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'enfermeira')
  );

CREATE POLICY "Saude acoes delete admin/enfermeira"
  ON public.saude_acoes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'enfermeira')
  );

CREATE TRIGGER trg_saude_acoes_updated
  BEFORE UPDATE ON public.saude_acoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_saude_acoes_empresa ON public.saude_acoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_saude_acoes_data ON public.saude_acoes(data);
CREATE INDEX IF NOT EXISTS idx_saude_agendamentos_categoria ON public.saude_agendamentos(categoria);
