ALTER TABLE public.orbit_envios ADD COLUMN IF NOT EXISTS competencia text;

UPDATE public.orbit_envios
SET competencia = to_char(enviado_em AT TIME ZONE 'America/Manaus', 'YYYY-MM')
WHERE competencia IS NULL;

CREATE INDEX IF NOT EXISTS idx_orbit_envios_competencia ON public.orbit_envios (competencia);