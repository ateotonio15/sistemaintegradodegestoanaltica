CREATE TABLE public.orbit_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_nome text NOT NULL,
  contrato text,
  orbit_user text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orbit_envios_lookup ON public.orbit_envios (lower(empresa_nome), coalesce(contrato,''), lower(orbit_user));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orbit_envios TO authenticated;
GRANT ALL ON public.orbit_envios TO service_role;

ALTER TABLE public.orbit_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orbit_envios_select" ON public.orbit_envios FOR SELECT TO authenticated USING (true);
CREATE POLICY "orbit_envios_insert" ON public.orbit_envios FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "orbit_envios_delete_admin" ON public.orbit_envios FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));