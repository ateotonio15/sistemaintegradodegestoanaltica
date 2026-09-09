ALTER TYPE public.bloqueio_periodo ADD VALUE IF NOT EXISTS 'horario';
ALTER TABLE public.bloqueios_calendario ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fim time;