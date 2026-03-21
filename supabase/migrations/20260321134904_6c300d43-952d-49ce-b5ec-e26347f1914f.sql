CREATE POLICY "Visualizacao view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'visualizacao'::app_role));