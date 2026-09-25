CREATE OR REPLACE FUNCTION public.trg_triagens_calc()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    WHEN v_pa IN ('Hipertensão Estágio 2','Hipertensão Estágio 3','HA Estágio 2','HA Estágio 3') OR v_gli = 'Diabetes' OR (v_imc IS NOT NULL AND v_imc >= 30) OR (NEW.tem_has AND NEW.tem_dm)
      THEN 'alto'
    WHEN v_pa IN ('Normal elevada','Hipertensão Estágio 1','Pré-Hipertensão','HA Estágio 1') OR v_gli IN ('Pré-Diabetes','Alterada pós-prandial') OR (v_imc IS NOT NULL AND v_imc >= 25) OR NEW.tem_has OR NEW.tem_dm
      THEN 'medio'
    ELSE 'baixo'
  END;
  RETURN NEW;
END $function$;