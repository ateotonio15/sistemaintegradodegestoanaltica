
ALTER TABLE public.painel_tv_meta_diaria
  ADD COLUMN IF NOT EXISTS usuarios jsonb NOT NULL DEFAULT '[]'::jsonb;
