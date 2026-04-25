DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financeiro_movimentacoes'
      AND policyname = 'Financeiro manage financeiro_movimentacoes'
  ) THEN
    CREATE POLICY "Financeiro manage financeiro_movimentacoes"
    ON public.financeiro_movimentacoes
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'financeiro'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'financeiro'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cobrancas'
      AND policyname = 'Financeiro manage cobrancas'
  ) THEN
    CREATE POLICY "Financeiro manage cobrancas"
    ON public.cobrancas
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'financeiro'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'financeiro'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'anexos_financeiro'
      AND policyname = 'Financeiro manage anexos_financeiro'
  ) THEN
    CREATE POLICY "Financeiro manage anexos_financeiro"
    ON public.anexos_financeiro
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'financeiro'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'financeiro'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'empresa_usuarios'
      AND policyname = 'Financeiro view all empresa_usuarios'
  ) THEN
    CREATE POLICY "Financeiro view all empresa_usuarios"
    ON public.empresa_usuarios
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'financeiro'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Financeiro view all profiles'
  ) THEN
    CREATE POLICY "Financeiro view all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'financeiro'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'Financeiro view all roles'
  ) THEN
    CREATE POLICY "Financeiro view all roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'financeiro'::public.app_role));
  END IF;
END $$;