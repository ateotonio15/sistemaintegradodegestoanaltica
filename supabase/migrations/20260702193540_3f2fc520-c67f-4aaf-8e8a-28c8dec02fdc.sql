-- Atualiza classificar_pa para o padrão do Ministério da Saúde
CREATE OR REPLACE FUNCTION public.classificar_pa(pas integer, pad integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN pas IS NULL OR pad IS NULL OR pas <= 0 OR pad <= 0 THEN 'Não realizado'
    WHEN pas >= 180 OR pad >= 110 THEN 'Hipertensão Estágio 3'
    WHEN pas >= 160 OR pad >= 100 THEN 'Hipertensão Estágio 2'
    WHEN pas >= 140 OR pad >=  90 THEN 'Hipertensão Estágio 1'
    WHEN pas >= 130 OR pad >=  85 THEN 'Normal elevada'
    WHEN pas >= 120 OR pad >=  80 THEN 'Normal'
    ELSE 'Ótima'
  END;
$$;

-- Recalcula classificação e risco de triagens existentes
UPDATE public.triagens
SET classificacao_pa = public.classificar_pa(pas_mmhg, pad_mmhg);

UPDATE public.triagens
SET risco_geral = CASE
  WHEN classificacao_pa IN ('Hipertensão Estágio 2','Hipertensão Estágio 3')
       OR classificacao_glicemia = 'Diabetes'
       OR (imc IS NOT NULL AND imc >= 30)
       OR (tem_has AND tem_dm) THEN 'alto'
  WHEN classificacao_pa IN ('Normal elevada','Hipertensão Estágio 1')
       OR classificacao_glicemia IN ('Pré-Diabetes','Alterada pós-prandial')
       OR (imc IS NOT NULL AND imc >= 25)
       OR tem_has OR tem_dm THEN 'medio'
  ELSE 'baixo'
END;