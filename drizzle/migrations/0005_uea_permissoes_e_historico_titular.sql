-- Permissões individuais do módulo Dependentes UEA
CREATE TABLE IF NOT EXISTS public.uea_permissoes (
  user_id UUID PRIMARY KEY,
  pode_visualizar BOOLEAN NOT NULL DEFAULT false,
  pode_editar BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uea_permissoes TO authenticated;
GRANT ALL ON public.uea_permissoes TO service_role;

ALTER TABLE public.uea_permissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uea_permissoes_self_select ON public.uea_permissoes;
CREATE POLICY uea_permissoes_self_select ON public.uea_permissoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS uea_permissoes_admin_all ON public.uea_permissoes;
CREATE POLICY uea_permissoes_admin_all ON public.uea_permissoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.uea_permissoes_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uea_permissoes_touch ON public.uea_permissoes;
CREATE TRIGGER trg_uea_permissoes_touch BEFORE UPDATE ON public.uea_permissoes
  FOR EACH ROW EXECUTE FUNCTION public.uea_permissoes_touch();

-- Acesso ao módulo: admin (regra atual de acesso total) OU permissão individual
CREATE OR REPLACE FUNCTION public.has_uea_access(_user_id UUID, _nivel TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.uea_permissoes p
        WHERE p.user_id = _user_id
          AND (
            (_nivel = 'editar' AND p.pode_editar)
            OR (_nivel <> 'editar' AND (p.pode_visualizar OR p.pode_editar))
          )
      );
$$;

-- Histórico por titular (append-only)
CREATE TABLE IF NOT EXISTS public.uea_titular_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id UUID NOT NULL REFERENCES public.uea_titulares(id) ON DELETE CASCADE,
  dependente_id UUID,
  dependente_nome TEXT,
  tipo TEXT NOT NULL,
  descricao TEXT,
  valor_anterior NUMERIC(12,2),
  valor_novo NUMERIC(12,2),
  margem_momento NUMERIC(12,2),
  margem_restante_momento NUMERIC(12,2),
  motivo TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uea_titular_historico_titular
  ON public.uea_titular_historico (titular_id, created_at DESC);

GRANT SELECT, INSERT ON public.uea_titular_historico TO authenticated;
GRANT ALL ON public.uea_titular_historico TO service_role;

ALTER TABLE public.uea_titular_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uea_titular_historico_select ON public.uea_titular_historico;
CREATE POLICY uea_titular_historico_select ON public.uea_titular_historico
  FOR SELECT TO authenticated
  USING (public.has_uea_access(auth.uid(), 'ver'));

DROP POLICY IF EXISTS uea_titular_historico_insert ON public.uea_titular_historico;
CREATE POLICY uea_titular_historico_insert ON public.uea_titular_historico
  FOR INSERT TO authenticated
  WITH CHECK (public.has_uea_access(auth.uid(), 'editar'));

-- Policies do módulo passam a usar a permissão individual (admin preservado)
DROP POLICY IF EXISTS uea_titulares_admin_all ON public.uea_titulares;
DROP POLICY IF EXISTS uea_titulares_select ON public.uea_titulares;
CREATE POLICY uea_titulares_select ON public.uea_titulares
  FOR SELECT TO authenticated USING (public.has_uea_access(auth.uid(), 'ver'));
DROP POLICY IF EXISTS uea_titulares_write ON public.uea_titulares;
CREATE POLICY uea_titulares_write ON public.uea_titulares
  FOR ALL TO authenticated
  USING (public.has_uea_access(auth.uid(), 'editar'))
  WITH CHECK (public.has_uea_access(auth.uid(), 'editar'));

DROP POLICY IF EXISTS uea_dependentes_admin_all ON public.uea_dependentes;
DROP POLICY IF EXISTS uea_dependentes_select ON public.uea_dependentes;
CREATE POLICY uea_dependentes_select ON public.uea_dependentes
  FOR SELECT TO authenticated USING (public.has_uea_access(auth.uid(), 'ver'));
DROP POLICY IF EXISTS uea_dependentes_write ON public.uea_dependentes;
CREATE POLICY uea_dependentes_write ON public.uea_dependentes
  FOR ALL TO authenticated
  USING (public.has_uea_access(auth.uid(), 'editar'))
  WITH CHECK (public.has_uea_access(auth.uid(), 'editar'));

DROP POLICY IF EXISTS uea_faixas_admin_all ON public.uea_faixas;
DROP POLICY IF EXISTS uea_faixas_select ON public.uea_faixas;
CREATE POLICY uea_faixas_select ON public.uea_faixas
  FOR SELECT TO authenticated USING (public.has_uea_access(auth.uid(), 'ver'));
DROP POLICY IF EXISTS uea_faixas_write ON public.uea_faixas;
CREATE POLICY uea_faixas_write ON public.uea_faixas
  FOR ALL TO authenticated
  USING (public.has_uea_access(auth.uid(), 'editar'))
  WITH CHECK (public.has_uea_access(auth.uid(), 'editar'));

DROP POLICY IF EXISTS uea_dependente_historico_admin_all ON public.uea_dependente_historico;
DROP POLICY IF EXISTS uea_dependente_historico_select ON public.uea_dependente_historico;
CREATE POLICY uea_dependente_historico_select ON public.uea_dependente_historico
  FOR SELECT TO authenticated USING (public.has_uea_access(auth.uid(), 'ver'));
DROP POLICY IF EXISTS uea_dependente_historico_insert ON public.uea_dependente_historico;
CREATE POLICY uea_dependente_historico_insert ON public.uea_dependente_historico
  FOR INSERT TO authenticated WITH CHECK (public.has_uea_access(auth.uid(), 'editar'));