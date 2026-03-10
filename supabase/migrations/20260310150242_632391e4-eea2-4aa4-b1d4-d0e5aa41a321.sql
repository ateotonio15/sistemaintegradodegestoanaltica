
-- Drop the restrictive policy for comum users on empresas
DROP POLICY IF EXISTS "User view own empresas" ON public.empresas;

-- Create new policy allowing all authenticated users to view all empresas
CREATE POLICY "Authenticated users view all empresas"
ON public.empresas
FOR SELECT
TO authenticated
USING (true);
