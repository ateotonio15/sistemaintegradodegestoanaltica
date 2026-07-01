
DROP FUNCTION IF EXISTS public.classificar_pa(integer, integer);
DROP FUNCTION IF EXISTS public.classificar_glicemia(numeric, boolean);

CREATE FUNCTION public.classificar_pa(pas integer, pad integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN pas IS NULL OR pad IS NULL THEN 'Não realizado'
    WHEN pas >= 180 OR pad >= 110 THEN 'HA Estágio 3'
    WHEN pas >= 160 OR pad >= 100 THEN 'HA Estágio 2'
    WHEN pas >= 140 OR pad >=  90 THEN 'HA Estágio 1'
    WHEN pas >= 120 OR pad >=  80 THEN 'Pré-Hipertensão'
    ELSE 'Normal'
  END
$$;

CREATE FUNCTION public.classificar_glicemia(g numeric, jejum boolean)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN g IS NULL OR g <= 0 THEN NULL
    WHEN COALESCE(jejum,false) THEN
      CASE WHEN g < 100 THEN 'Normal' WHEN g < 126 THEN 'Pré-Diabetes' ELSE 'Diabetes' END
    ELSE
      CASE WHEN g < 140 THEN 'Normal' WHEN g < 200 THEN 'Alterada pós-prandial' ELSE 'Diabetes' END
  END
$$;

CREATE OR REPLACE FUNCTION public.trg_triagens_calc()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_pa text; v_gli text; v_imc numeric;
BEGIN
  NEW.imc := public.calcular_imc(NEW.peso_kg, NEW.altura_cm);
  NEW.rcq := public.calcular_rcq(NEW.circ_abdominal_cm, NEW.circ_quadril_cm);
  IF NEW.data_nascimento IS NOT NULL THEN
    NEW.idade := public.calcular_idade(NEW.data_nascimento);
  END IF;
  NEW.classificacao_pa := public.classificar_pa(NEW.pas_mmhg, NEW.pad_mmhg);
  NEW.classificacao_glicemia := public.classificar_glicemia(NEW.glicemia_mg_dl, NEW.jejum);

  v_pa := NEW.classificacao_pa;
  v_gli := NEW.classificacao_glicemia;
  v_imc := NEW.imc;
  NEW.risco_geral := CASE
    WHEN v_pa IN ('HA Estágio 2','HA Estágio 3') OR v_gli = 'Diabetes' OR (v_imc IS NOT NULL AND v_imc >= 30) OR (NEW.tem_has AND NEW.tem_dm)
      THEN 'alto'
    WHEN v_pa IN ('Pré-Hipertensão','HA Estágio 1') OR v_gli IN ('Pré-Diabetes','Alterada pós-prandial') OR (v_imc IS NOT NULL AND v_imc >= 25) OR NEW.tem_has OR NEW.tem_dm
      THEN 'medio'
    ELSE 'baixo'
  END;
  RETURN NEW;
END $$;
