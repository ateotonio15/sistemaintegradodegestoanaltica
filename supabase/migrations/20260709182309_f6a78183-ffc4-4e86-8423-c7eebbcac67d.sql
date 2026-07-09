DROP POLICY IF EXISTS "User update own profile" ON public.profiles;
CREATE POLICY "User update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());