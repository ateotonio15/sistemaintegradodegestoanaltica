CREATE TABLE public.config_sync (
  chave text PRIMARY KEY,
  valor text NOT NULL
);

GRANT ALL ON public.config_sync TO service_role;

ALTER TABLE public.config_sync ENABLE ROW LEVEL SECURITY;

INSERT INTO public.config_sync (chave, valor) VALUES ('sync_cnpj_token', gen_random_uuid()::text);