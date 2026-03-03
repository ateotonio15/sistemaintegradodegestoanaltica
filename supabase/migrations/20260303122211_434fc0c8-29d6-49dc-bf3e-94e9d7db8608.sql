
-- Fix profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Executivo view all profiles" ON public.profiles;

CREATE POLICY "Admin view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Fix user_roles policies
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Executivo view all user roles" ON public.user_roles;

CREATE POLICY "Admin manage all roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view own role" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Fix empresa_usuarios policies
DROP POLICY IF EXISTS "Admins can manage empresa_usuarios" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Users can view own links" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Admin view all company users" ON public.empresa_usuarios;
DROP POLICY IF EXISTS "Executivo view all company users" ON public.empresa_usuarios;

CREATE POLICY "Admin manage all empresa_usuarios" ON public.empresa_usuarios AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all empresa_usuarios" ON public.empresa_usuarios AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view own empresa_usuarios" ON public.empresa_usuarios AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Fix empresas policies (broken self-join reference)
DROP POLICY IF EXISTS "Users view linked empresas" ON public.empresas;
DROP POLICY IF EXISTS "Admins full access to empresas" ON public.empresas;

CREATE POLICY "Admin full access empresas" ON public.empresas AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all empresas" ON public.empresas AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view linked empresas" ON public.empresas AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = empresas.id AND eu.user_id = auth.uid()));

-- Fix movimentacoes policies
DROP POLICY IF EXISTS "Admins full access to movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Users view linked movimentacoes" ON public.movimentacoes;

CREATE POLICY "Admin full access movimentacoes" ON public.movimentacoes AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Executivo view all movimentacoes" ON public.movimentacoes AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'executivo'));
CREATE POLICY "User view linked movimentacoes" ON public.movimentacoes AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid()));
