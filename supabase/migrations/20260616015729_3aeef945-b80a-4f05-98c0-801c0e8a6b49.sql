
-- 1. Table
CREATE TABLE IF NOT EXISTS public.feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data date NOT NULL,
  ano integer NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Nacional','Estadual','Municipal','Facultativo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data, nome)
);

GRANT SELECT ON public.feriados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriados TO authenticated;
GRANT ALL ON public.feriados TO service_role;

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read feriados"
  ON public.feriados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage feriados"
  ON public.feriados FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_feriados_data ON public.feriados (data);
CREATE INDEX IF NOT EXISTS idx_feriados_ano ON public.feriados (ano);

-- updated_at trigger
CREATE TRIGGER trg_feriados_updated_at
  BEFORE UPDATE ON public.feriados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Função para calcular a Páscoa (algoritmo de Meeus)
CREATE OR REPLACE FUNCTION public.calc_pascoa(_ano integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a int; b int; c int; d int; e int; f int;
  g int; h int; i int; k int; L int; m int;
  mes int; dia int;
BEGIN
  a := _ano % 19;
  b := _ano / 100;
  c := _ano % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  L := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * L) / 451;
  mes := (h + L - 7 * m + 114) / 31;
  dia := ((h + L - 7 * m + 114) % 31) + 1;
  RETURN make_date(_ano, mes, dia);
END;
$$;

-- 3. Função para gerar feriados de um ano
CREATE OR REPLACE FUNCTION public.gerar_feriados_ano(_ano integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pa date;
BEGIN
  pa := public.calc_pascoa(_ano);

  -- Nacionais (fixos)
  INSERT INTO public.feriados (nome, data, ano, tipo) VALUES
    ('Confraternização Universal', make_date(_ano, 1, 1), _ano, 'Nacional'),
    ('Tiradentes', make_date(_ano, 4, 21), _ano, 'Nacional'),
    ('Dia do Trabalhador', make_date(_ano, 5, 1), _ano, 'Nacional'),
    ('Independência do Brasil', make_date(_ano, 9, 7), _ano, 'Nacional'),
    ('Nossa Senhora Aparecida', make_date(_ano, 10, 12), _ano, 'Nacional'),
    ('Finados', make_date(_ano, 11, 2), _ano, 'Nacional'),
    ('Proclamação da República', make_date(_ano, 11, 15), _ano, 'Nacional'),
    ('Dia da Consciência Negra', make_date(_ano, 11, 20), _ano, 'Nacional'),
    ('Natal', make_date(_ano, 12, 25), _ano, 'Nacional')
  ON CONFLICT (data, nome) DO NOTHING;

  -- Nacionais (móveis)
  INSERT INTO public.feriados (nome, data, ano, tipo) VALUES
    ('Sexta-feira Santa', pa - INTERVAL '2 days', _ano, 'Nacional'),
    ('Domingo de Páscoa', pa, _ano, 'Nacional'),
    ('Corpus Christi', pa + INTERVAL '60 days', _ano, 'Nacional')
  ON CONFLICT (data, nome) DO NOTHING;

  -- Estaduais (AM)
  INSERT INTO public.feriados (nome, data, ano, tipo) VALUES
    ('Elevação do Amazonas à categoria de Província', make_date(_ano, 9, 5), _ano, 'Estadual')
  ON CONFLICT (data, nome) DO NOTHING;

  -- Municipais (Manaus)
  INSERT INTO public.feriados (nome, data, ano, tipo) VALUES
    ('Aniversário de Manaus', make_date(_ano, 10, 24), _ano, 'Municipal'),
    ('Nossa Senhora da Conceição (Padroeira de Manaus)', make_date(_ano, 12, 8), _ano, 'Municipal')
  ON CONFLICT (data, nome) DO NOTHING;
END;
$$;

-- 4. Popular anos 2024-2035
DO $$
DECLARE
  y integer;
BEGIN
  FOR y IN 2024..2035 LOOP
    PERFORM public.gerar_feriados_ano(y);
  END LOOP;
END;
$$;
