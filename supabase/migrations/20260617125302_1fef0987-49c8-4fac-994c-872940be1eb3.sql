
CREATE TABLE IF NOT EXISTS public.painel_tv_meta_diaria (
  data DATE NOT NULL PRIMARY KEY,
  valor INTEGER NOT NULL CHECK (valor >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.painel_tv_meta_diaria TO authenticated;
GRANT ALL ON public.painel_tv_meta_diaria TO service_role;
ALTER TABLE public.painel_tv_meta_diaria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read meta diaria" ON public.painel_tv_meta_diaria FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write meta diaria" ON public.painel_tv_meta_diaria FOR ALL TO authenticated USING (true) WITH CHECK (true);
