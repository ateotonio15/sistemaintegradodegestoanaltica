-- Grant SELECT-only access to visualizacao users on all main tables

CREATE POLICY "Visualizacao view all empresas"
ON public.empresas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'visualizacao'::app_role));

CREATE POLICY "Visualizacao view all movimentacoes"
ON public.movimentacoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'visualizacao'::app_role));

CREATE POLICY "Visualizacao view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'visualizacao'::app_role));

CREATE POLICY "Visualizacao view own role"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'visualizacao'::app_role) AND user_id = auth.uid());

CREATE POLICY "Visualizacao view all empresa_usuarios"
ON public.empresa_usuarios FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'visualizacao'::app_role));
