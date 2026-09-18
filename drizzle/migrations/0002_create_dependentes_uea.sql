-- Módulo independente: Dependentes UEA
CREATE TABLE public.uea_titulares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  matricula text,
  contrato text,
  valor_margem numeric(12,2) NOT NULL DEFAULT 0,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uea_titulares_cpf_uidx ON public.uea_titulares (cpf);

CREATE TABLE public.uea_dependentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id uuid NOT NULL REFERENCES public.uea_titulares(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  cpf text,
  data_nascimento date,
  parentesco text,
  faixa_etaria text,
  valor_mensal numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  motivo_desligamento text,
  data_desligamento date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uea_dependentes_status_chk CHECK (status IN ('ativo','desligado'))
);
CREATE INDEX uea_dependentes_titular_idx ON public.uea_dependentes (titular_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uea_titulares TO authenticated;
GRANT ALL ON public.uea_titulares TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uea_dependentes TO authenticated;
GRANT ALL ON public.uea_dependentes TO service_role;

ALTER TABLE public.uea_titulares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uea_dependentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uea_titulares_admin_all" ON public.uea_titulares
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "uea_dependentes_admin_all" ON public.uea_dependentes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.uea_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_uea_titulares_touch BEFORE UPDATE ON public.uea_titulares
  FOR EACH ROW EXECUTE FUNCTION public.uea_touch_updated_at();
CREATE TRIGGER trg_uea_dependentes_touch BEFORE UPDATE ON public.uea_dependentes
  FOR EACH ROW EXECUTE FUNCTION public.uea_touch_updated_at();
