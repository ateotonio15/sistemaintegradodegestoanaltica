ALTER TABLE public.acoes_saude 
  ADD COLUMN IF NOT EXISTS tem_pa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tem_glicemia boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tem_bioimpedancia boolean NOT NULL DEFAULT false;

ALTER TABLE public.triagens ADD COLUMN IF NOT EXISTS tem_bio boolean NOT NULL DEFAULT false;