
-- 1) Novo valor de enum (precisa ser committed antes de uso via literal)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_interno';

-- 2) Coluna papel no vínculo existente
ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS papel text NOT NULL DEFAULT 'colaborador';

-- 3) Helper SECURITY DEFINER (usa role::text para não depender do commit do enum)
CREATE OR REPLACE FUNCTION public.user_pode_ver_empresa(_empresa uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role::text = 'admin_interno'
    )
    OR EXISTS (
      SELECT 1 FROM public.empresa_usuarios
      WHERE user_id = auth.uid() AND empresa_id = _empresa
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_interno()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'admin_interno'
  );
$$;

-- 4) contratos
CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  valor_mensal numeric(14,2),
  data_inicio date,
  data_fim date,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS contratos_empresa_id_idx ON public.contratos(empresa_id);

CREATE POLICY "contratos_select_vinculo" ON public.contratos
  FOR SELECT TO authenticated
  USING (public.user_pode_ver_empresa(empresa_id));
CREATE POLICY "contratos_insert_vinculo" ON public.contratos
  FOR INSERT TO authenticated
  WITH CHECK (public.user_pode_ver_empresa(empresa_id));
CREATE POLICY "contratos_update_vinculo" ON public.contratos
  FOR UPDATE TO authenticated
  USING (public.user_pode_ver_empresa(empresa_id))
  WITH CHECK (public.user_pode_ver_empresa(empresa_id));
CREATE POLICY "contratos_delete_admin_interno" ON public.contratos
  FOR DELETE TO authenticated
  USING (public.is_admin_interno());

-- 5) vidas_ativas
CREATE TABLE IF NOT EXISTS public.vidas_ativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_beneficiario text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  data_inclusao date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vidas_ativas TO authenticated;
GRANT ALL ON public.vidas_ativas TO service_role;
ALTER TABLE public.vidas_ativas ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS vidas_ativas_empresa_id_idx ON public.vidas_ativas(empresa_id);

CREATE POLICY "vidas_ativas_select_vinculo" ON public.vidas_ativas
  FOR SELECT TO authenticated
  USING (public.user_pode_ver_empresa(empresa_id));
CREATE POLICY "vidas_ativas_insert_vinculo" ON public.vidas_ativas
  FOR INSERT TO authenticated
  WITH CHECK (public.user_pode_ver_empresa(empresa_id));
CREATE POLICY "vidas_ativas_update_vinculo" ON public.vidas_ativas
  FOR UPDATE TO authenticated
  USING (public.user_pode_ver_empresa(empresa_id))
  WITH CHECK (public.user_pode_ver_empresa(empresa_id));
CREATE POLICY "vidas_ativas_delete_admin_interno" ON public.vidas_ativas
  FOR DELETE TO authenticated
  USING (public.is_admin_interno());

-- 6) movimentacao_financeira
CREATE TABLE IF NOT EXISTS public.movimentacao_financeira (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  valor numeric(14,2) NOT NULL,
  descricao text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacao_financeira TO authenticated;
GRANT ALL ON public.movimentacao_financeira TO service_role;
ALTER TABLE public.movimentacao_financeira ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS mov_fin_empresa_id_idx ON public.movimentacao_financeira(empresa_id);
CREATE INDEX IF NOT EXISTS mov_fin_empresa_data_idx ON public.movimentacao_financeira(empresa_id, data);

CREATE POLICY "mov_fin_select_vinculo" ON public.movimentacao_financeira
  FOR SELECT TO authenticated
  USING (public.user_pode_ver_empresa(empresa_id));
CREATE POLICY "mov_fin_insert_vinculo" ON public.movimentacao_financeira
  FOR INSERT TO authenticated
  WITH CHECK (public.user_pode_ver_empresa(empresa_id));
CREATE POLICY "mov_fin_update_vinculo" ON public.movimentacao_financeira
  FOR UPDATE TO authenticated
  USING (public.user_pode_ver_empresa(empresa_id))
  WITH CHECK (public.user_pode_ver_empresa(empresa_id));
CREATE POLICY "mov_fin_delete_admin_interno" ON public.movimentacao_financeira
  FOR DELETE TO authenticated
  USING (public.is_admin_interno());
