-- Drop old tables (both are empty)
DROP TABLE IF EXISTS public.palestras_saude CASCADE;
DROP TABLE IF EXISTS public.palestras_bloqueios CASCADE;

-- Enums (reuse if exist, otherwise create)
DO $$ BEGIN
  CREATE TYPE public.palestra_status AS ENUM ('a_confirmar','confirmado','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bloqueio_periodo AS ENUM ('dia_todo','manha','tarde');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ palestras_saude ============
CREATE TABLE public.palestras_saude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  endereco text NOT NULL,
  data date NOT NULL,
  horario_inicio time,
  horario_fim time,
  tema text,
  observacao text,
  status public.palestra_status NOT NULL DEFAULT 'a_confirmar',
  motivo_cancelamento text,
  executiva text NOT NULL,
  criado_por text,
  editado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.palestras_saude TO authenticated;
GRANT ALL ON public.palestras_saude TO service_role;

ALTER TABLE public.palestras_saude ENABLE ROW LEVEL SECURITY;

-- Read for any authenticated user
CREATE POLICY "palestras_read_all_auth"
  ON public.palestras_saude FOR SELECT
  TO authenticated USING (true);

-- Write only for admin, executivo, enfermeira
CREATE POLICY "palestras_insert_editors"
  ON public.palestras_saude FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'executivo'::app_role)
    OR public.has_role(auth.uid(), 'enfermeira'::app_role)
  );

CREATE POLICY "palestras_update_editors"
  ON public.palestras_saude FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'executivo'::app_role)
    OR public.has_role(auth.uid(), 'enfermeira'::app_role)
  );

CREATE POLICY "palestras_delete_editors"
  ON public.palestras_saude FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'executivo'::app_role)
    OR public.has_role(auth.uid(), 'enfermeira'::app_role)
  );

CREATE TRIGGER trg_palestras_saude_updated
  BEFORE UPDATE ON public.palestras_saude
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_palestras_saude_data ON public.palestras_saude(data);
CREATE INDEX idx_palestras_saude_status ON public.palestras_saude(status);

-- ============ bloqueios_calendario ============
CREATE TABLE public.bloqueios_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  periodo public.bloqueio_periodo NOT NULL,
  motivo text NOT NULL,
  criado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bloqueios_calendario TO authenticated;
GRANT ALL ON public.bloqueios_calendario TO service_role;

ALTER TABLE public.bloqueios_calendario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bloqueios_read_all_auth"
  ON public.bloqueios_calendario FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "bloqueios_insert_editors"
  ON public.bloqueios_calendario FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'executivo'::app_role)
    OR public.has_role(auth.uid(), 'enfermeira'::app_role)
  );

CREATE POLICY "bloqueios_update_editors"
  ON public.bloqueios_calendario FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'executivo'::app_role)
    OR public.has_role(auth.uid(), 'enfermeira'::app_role)
  );

CREATE POLICY "bloqueios_delete_editors"
  ON public.bloqueios_calendario FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'executivo'::app_role)
    OR public.has_role(auth.uid(), 'enfermeira'::app_role)
  );

CREATE INDEX idx_bloqueios_calendario_data ON public.bloqueios_calendario(data);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.palestras_saude;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bloqueios_calendario;