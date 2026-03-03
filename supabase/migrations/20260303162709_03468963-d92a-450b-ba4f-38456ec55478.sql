
-- 1. Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Backfill usernames from auth.users email
DO $$
DECLARE
  rec RECORD;
  base_username text;
  final_username text;
  counter int;
BEGIN
  FOR rec IN
    SELECT p.user_id, u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.username IS NULL
  LOOP
    base_username := lower(split_part(rec.email, '@', 1));
    base_username := regexp_replace(base_username, '[^a-z0-9._-]', '', 'g');
    IF base_username = '' THEN base_username := 'user'; END IF;
    final_username := base_username;
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
      final_username := base_username || counter;
      counter := counter + 1;
    END LOOP;
    UPDATE public.profiles SET username = final_username WHERE user_id = rec.user_id;
  END LOOP;
END $$;

-- Make username NOT NULL and UNIQUE
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- 2. Security definer function for login lookup (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE lower(p.username) = lower(_username)
  LIMIT 1
$$;

-- Grant execute to anon and authenticated so login works
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated;

-- 3. Update movimentacoes SELECT policy to include responsavel_user_id
DROP POLICY IF EXISTS "User view linked movimentacoes" ON public.movimentacoes;
CREATE POLICY "User view linked movimentacoes"
ON public.movimentacoes
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = movimentacoes.empresa_id AND e.responsavel_user_id = auth.uid())
);

-- 4. Update movimentacoes UPDATE policy to include responsavel_user_id
DROP POLICY IF EXISTS "User update linked movimentacoes" ON public.movimentacoes;
CREATE POLICY "User update linked movimentacoes"
ON public.movimentacoes
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = movimentacoes.empresa_id AND e.responsavel_user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = movimentacoes.empresa_id AND e.responsavel_user_id = auth.uid())
);
