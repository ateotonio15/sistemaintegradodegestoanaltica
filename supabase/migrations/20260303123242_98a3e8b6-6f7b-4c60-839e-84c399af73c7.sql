
-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE

-- profiles
DROP POLICY IF EXISTS "Admin view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Executivo view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "User view own profile" ON public.profiles;
DROP POLICY IF EXISTS "User update own profile" ON public.profiles;

CREATE POLICY "Admin view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- user_roles
DROP POLICY IF EXISTS "Admin manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Executivo view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "User view own role" ON public.user_roles;

CREATE POLICY "Admin manage all roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view own role" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());

-- empresa_usuarios
DROP POLICY IF EXISTS "Admin manage all empresa_usuarios" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Executivo view all empresa_usuarios" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "User view own empresa_usuarios" ON public.empresa_usuarios;

CREATE POLICY "Admin manage all empresa_usuarios" ON public.empresa_usuarios AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all empresa_usuarios" ON public.empresa_usuarios AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view own empresa_usuarios" ON public.empresa_usuarios AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());

-- empresas
DROP POLICY IF EXISTS "Admin full access empresas" ON public.empresas;
DROP POLICY IF EXISTS "Executivo view all empresas" ON public.empresas;
DROP POLICY IF EXISTS "User view linked empresas" ON public.empresas;

CREATE POLICY "Admin full access empresas" ON public.empresas AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all empresas" ON public.empresas AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view linked empresas" ON public.empresas AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = empresas.id AND eu.user_id = auth.uid()));

-- movimentacoes
DROP POLICY IF EXISTS "Admin full access movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Executivo view all movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "User view linked movimentacoes" ON public.movimentacoes;

CREATE POLICY "Admin full access movimentacoes" ON public.movimentacoes AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all movimentacoes" ON public.movimentacoes AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view linked movimentacoes" ON public.movimentacoes AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid()));
