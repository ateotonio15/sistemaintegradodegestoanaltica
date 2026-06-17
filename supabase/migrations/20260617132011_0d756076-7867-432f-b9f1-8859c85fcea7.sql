
ALTER TABLE public.painel_tv_meta_diaria
  ADD COLUMN IF NOT EXISTS iniciada_em timestamptz NOT NULL DEFAULT now();
