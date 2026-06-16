
-- Restrict triagens DELETE: admin/diretora always; enfermeira only own records
DROP POLICY IF EXISTS triagens_del ON public.triagens;
CREATE POLICY triagens_del ON public.triagens
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'diretora'::app_role)
    OR (
      public.has_role(auth.uid(), 'enfermeira'::app_role)
      AND created_by = auth.uid()
    )
  );

-- Fix mutable search_path on calc_pascoa
CREATE OR REPLACE FUNCTION public.calc_pascoa(_ano integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
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
