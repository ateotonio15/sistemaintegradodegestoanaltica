
-- 1. Flag para troca de senha obrigatória
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- 2. Policies SELECT para admin_empresa via helper user_pode_ver_empresa
-- (helper já criado em migração anterior)

-- empresas: admin_empresa vê a própria empresa
DROP POLICY IF EXISTS "admin_empresa pode ver a propria empresa" ON public.empresas;
CREATE POLICY "admin_empresa pode ver a propria empresa"
ON public.empresas FOR SELECT
TO authenticated
USING (public.user_pode_ver_empresa(id));

-- movimentacoes: admin_empresa vê movimentações da própria empresa
DROP POLICY IF EXISTS "admin_empresa pode ver movimentacoes da propria empresa" ON public.movimentacoes;
CREATE POLICY "admin_empresa pode ver movimentacoes da propria empresa"
ON public.movimentacoes FOR SELECT
TO authenticated
USING (public.user_pode_ver_empresa(empresa_id));
