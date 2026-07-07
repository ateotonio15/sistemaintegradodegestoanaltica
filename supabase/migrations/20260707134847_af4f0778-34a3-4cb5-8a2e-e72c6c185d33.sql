CREATE OR REPLACE FUNCTION public.classificar_pa(pas integer, pad integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF pas IS NULL OR pad IS NULL OR pas <= 0 OR pad <= 0 THEN
    RETURN 'Não realizado';
  END IF;
  IF pas >= 180 OR pad >= 110 THEN RETURN 'Hipertensão Estágio 3'; END IF;
  IF pas >= 160 OR pad >= 100 THEN RETURN 'Hipertensão Estágio 2'; END IF;
  IF pas >= 140 OR pad >= 90  THEN RETURN 'Hipertensão Estágio 1'; END IF;
  IF pas >= 130                THEN RETURN 'PA Elevada'; END IF;
  IF pas >= 120 OR pad >= 80  THEN RETURN 'Normal'; END IF;
  RETURN 'Ótima';
END;
$$;

-- Reclassifica triagens existentes conforme a nova regra
UPDATE public.triagens
SET classificacao_pa = public.classificar_pa(pas_mmhg, pad_mmhg)
WHERE classificacao_pa IS DISTINCT FROM public.classificar_pa(pas_mmhg, pad_mmhg);