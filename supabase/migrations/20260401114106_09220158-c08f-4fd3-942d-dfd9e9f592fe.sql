
CREATE POLICY "Comum view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'comum'::app_role));

CREATE POLICY "Comum view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'comum'::app_role));
