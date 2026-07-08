
-- ============================================================
-- 1) user_roles: hide privileged roles from non-admin viewers
-- ============================================================
DROP POLICY IF EXISTS "Comum view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Diretora view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Diretora view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Enfermeira view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Executivo view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Executivo externo view all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Financeiro view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Visualizacao view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Visualizacao view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Administradoras view all roles" ON public.user_roles;

-- Non-admin authenticated users can only see non-privileged role rows
CREATE POLICY "Authenticated view non-privileged roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (role NOT IN ('admin'::public.app_role, 'diretora'::public.app_role));

-- Users always see their own role rows (including privileged)
-- (existing "User view own role" policy remains; recreate defensively if absent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='User view own role'
  ) THEN
    CREATE POLICY "User view own role"
    ON public.user_roles FOR SELECT TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Admin retains full access via existing "Admin manage all roles" policy

-- ============================================================
-- 2) profiles.username: revoke column privilege, expose via RPC
-- ============================================================
REVOKE SELECT (username) ON public.profiles FROM authenticated;
REVOKE SELECT (username) ON public.profiles FROM anon;

-- Self lookup
CREATE OR REPLACE FUNCTION public.get_my_username()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT username FROM public.profiles WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_username() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_username() TO authenticated;

-- Admin-only listing of usernames
CREATE OR REPLACE FUNCTION public.admin_list_usernames()
RETURNS TABLE(user_id uuid, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role);
$$;
REVOKE ALL ON FUNCTION public.admin_list_usernames() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_usernames() TO authenticated;
