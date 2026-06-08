
-- Honda Exclusões module
CREATE TABLE IF NOT EXISTS public.honda_exclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_operacao text,
  sequencia text,
  nome_beneficiario text NOT NULL,
  cpf text NOT NULL,
  data_demissao date NOT NULL,
  motivo text,
  concluido boolean NOT NULL DEFAULT false,
  importado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  importado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_honda_excl_data ON public.honda_exclusoes(data_demissao);
CREATE INDEX IF NOT EXISTS idx_honda_excl_cpf ON public.honda_exclusoes(cpf);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.honda_exclusoes TO authenticated;
GRANT ALL ON public.honda_exclusoes TO service_role;

ALTER TABLE public.honda_exclusoes ENABLE ROW LEVEL SECURITY;

-- Function to check if user can access honda exclusoes
CREATE OR REPLACE FUNCTION public.can_access_honda_exclusoes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'diretora'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.empresa_usuarios eu
      JOIN public.empresas e ON e.id = eu.empresa_id
      WHERE eu.user_id = _user_id
        AND upper(e.nome) LIKE '%HONDA%'
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_honda_exclusoes(uuid) TO authenticated;

CREATE POLICY "honda_excl_select" ON public.honda_exclusoes
  FOR SELECT TO authenticated
  USING (public.can_access_honda_exclusoes(auth.uid()));

CREATE POLICY "honda_excl_insert" ON public.honda_exclusoes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_honda_exclusoes(auth.uid()));

CREATE POLICY "honda_excl_update" ON public.honda_exclusoes
  FOR UPDATE TO authenticated
  USING (public.can_access_honda_exclusoes(auth.uid()))
  WITH CHECK (public.can_access_honda_exclusoes(auth.uid()));

CREATE POLICY "honda_excl_delete_admin" ON public.honda_exclusoes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_honda_exclusoes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_honda_exclusoes ON public.honda_exclusoes;
CREATE TRIGGER trg_touch_honda_exclusoes
  BEFORE UPDATE ON public.honda_exclusoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_honda_exclusoes();
