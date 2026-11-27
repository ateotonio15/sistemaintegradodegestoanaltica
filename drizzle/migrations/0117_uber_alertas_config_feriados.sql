ALTER TABLE public.feriados ADD COLUMN IF NOT EXISTS abrangencia text, ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
UPDATE public.feriados SET abrangencia = COALESCE(tipo,'Nacional') WHERE abrangencia IS NULL;
ALTER TABLE public.feriados ADD CONSTRAINT feriados_abrangencia_chk CHECK (abrangencia IS NULL OR abrangencia IN ('Nacional','Estadual','Municipal','Facultativo'));
UPDATE public.feriados SET abrangencia='Facultativo', ativo=false WHERE nome ILIKE 'Corpus Christi%' AND ano IN (2026,2027);
INSERT INTO public.feriados (nome,data,ano,tipo,abrangencia,ativo)
SELECT v.nome, v.data::date, extract(year from v.data::date)::int, 'Facultativo','Facultativo', false
FROM (VALUES ('Carnaval','2026-02-16'),('Carnaval','2026-02-17'),('Carnaval','2027-02-08'),('Carnaval','2027-02-09')) v(nome,data)
WHERE NOT EXISTS (SELECT 1 FROM public.feriados f WHERE f.data = v.data::date AND f.nome ILIKE 'Carnaval%');

CREATE TABLE public.uber_alertas_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  custo_ativo boolean NOT NULL DEFAULT true,
  custo_limite numeric NOT NULL DEFAULT 60,
  rota_preco_ativo boolean NOT NULL DEFAULT true,
  rota_preco_pct numeric NOT NULL DEFAULT 50,
  rota_preco_min integer NOT NULL DEFAULT 3,
  noturno_ativo boolean NOT NULL DEFAULT true,
  noturno_inicio text NOT NULL DEFAULT '19:00',
  noturno_fim text NOT NULL DEFAULT '05:00',
  fds_ativo boolean NOT NULL DEFAULT true,
  repetida_ativo boolean NOT NULL DEFAULT true,
  repetida_min integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE ON public.uber_alertas_config TO authenticated;
GRANT ALL ON public.uber_alertas_config TO service_role;
ALTER TABLE public.uber_alertas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem config alertas uber" ON public.uber_alertas_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins inserem config alertas uber" ON public.uber_alertas_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins alteram config alertas uber" ON public.uber_alertas_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.uber_alertas_config (id) VALUES (true);