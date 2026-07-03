-- ============================================================
-- Fix 1: honda_exclusoes — replace regex name match with explicit Honda company IDs
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_access_honda_exclusoes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'diretora'::app_role)
    OR (
      (
        public.has_role(_user_id, 'comum'::app_role)
        OR public.has_role(_user_id, 'administradoras'::app_role)
        OR public.has_role(_user_id, 'financeiro'::app_role)
        OR public.has_role(_user_id, 'executivo'::app_role)
      )
      AND EXISTS (
        SELECT 1
        FROM public.empresa_usuarios eu
        WHERE eu.user_id = _user_id
          AND eu.empresa_id IN (
            'b781e041-6196-4e72-a9ba-1a76e2346e58'::uuid, -- MOTO HONDA
            '8e56bc80-cd49-4b12-ba0d-2c3d99f899a2'::uuid, -- HONDA TRADING BRASIL LTDA
            'df333ade-1a6e-4bae-917d-1655c4ac4523'::uuid  -- HONDA COMPONENTES DA AMAZONIA LTDA
          )
      )
    );
$function$;

-- ============================================================
-- Fix 2: mailing_brindes — enforce created_by = auth.uid() on WITH CHECK for
-- non-admin roles (including executivo_externo) so external users cannot
-- attribute rows to another user.
-- ============================================================
DROP POLICY IF EXISTS "editors insert mailing" ON public.mailing_brindes;
DROP POLICY IF EXISTS "editors update mailing" ON public.mailing_brindes;
DROP POLICY IF EXISTS "editors delete mailing" ON public.mailing_brindes;

CREATE POLICY "editors insert mailing"
  ON public.mailing_brindes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR (
      (
        has_role(auth.uid(), 'executivo'::app_role)
        OR has_role(auth.uid(), 'executivo_externo'::app_role)
        OR has_role(auth.uid(), 'comum'::app_role)
        OR has_role(auth.uid(), 'administradoras'::app_role)
      )
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "editors update mailing"
  ON public.mailing_brindes
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR (
      (
        has_role(auth.uid(), 'executivo'::app_role)
        OR has_role(auth.uid(), 'executivo_externo'::app_role)
        OR has_role(auth.uid(), 'comum'::app_role)
        OR has_role(auth.uid(), 'administradoras'::app_role)
      )
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR (
      (
        has_role(auth.uid(), 'executivo'::app_role)
        OR has_role(auth.uid(), 'executivo_externo'::app_role)
        OR has_role(auth.uid(), 'comum'::app_role)
        OR has_role(auth.uid(), 'administradoras'::app_role)
      )
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "editors delete mailing"
  ON public.mailing_brindes
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR (
      (
        has_role(auth.uid(), 'executivo'::app_role)
        OR has_role(auth.uid(), 'executivo_externo'::app_role)
        OR has_role(auth.uid(), 'comum'::app_role)
        OR has_role(auth.uid(), 'administradoras'::app_role)
      )
      AND created_by = auth.uid()
    )
  );

-- Also tighten SELECT so executivo_externo sees only own rows (already the case,
-- but re-assert to keep policies aligned).
DROP POLICY IF EXISTS "mailing_brindes_role_select" ON public.mailing_brindes;
CREATE POLICY "mailing_brindes_role_select"
  ON public.mailing_brindes
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR (
      (
        has_role(auth.uid(), 'executivo'::app_role)
        OR has_role(auth.uid(), 'executivo_externo'::app_role)
        OR has_role(auth.uid(), 'comum'::app_role)
        OR has_role(auth.uid(), 'administradoras'::app_role)
      )
      AND created_by = auth.uid()
    )
  );