
DROP POLICY IF EXISTS "mailing_brindes_role_select" ON public.mailing_brindes;
DROP POLICY IF EXISTS "editors insert mailing" ON public.mailing_brindes;
DROP POLICY IF EXISTS "editors update mailing" ON public.mailing_brindes;
DROP POLICY IF EXISTS "editors delete mailing" ON public.mailing_brindes;

CREATE POLICY "mailing_brindes_role_select" ON public.mailing_brindes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'executivo_externo'::app_role)
  OR ((has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role)) AND (created_by = auth.uid()))
);

CREATE POLICY "editors insert mailing" ON public.mailing_brindes
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'executivo_externo'::app_role)
  OR ((has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role)) AND (created_by = auth.uid()))
);

CREATE POLICY "editors update mailing" ON public.mailing_brindes
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'executivo_externo'::app_role)
  OR ((has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role)) AND (created_by = auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'executivo_externo'::app_role)
  OR ((has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role)) AND (created_by = auth.uid()))
);

CREATE POLICY "editors delete mailing" ON public.mailing_brindes
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'executivo_externo'::app_role)
  OR ((has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role)) AND (created_by = auth.uid()))
);
