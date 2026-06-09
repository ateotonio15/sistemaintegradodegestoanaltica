CREATE OR REPLACE FUNCTION public.trg_reajuste_calc_campos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_impl date;
  v_mes_aplic int;
  v_ano_aplic int;
  v_diff int;
  v_enf_antigo bigint;
  v_apt_antigo bigint;
  v_usa_faixa_enf boolean := COALESCE(NEW.usa_faixa_etaria_enfermaria, false);
  v_usa_faixa_apt boolean := COALESCE(NEW.usa_faixa_etaria_apartamento, false);
BEGIN
  SELECT data_implantacao INTO v_impl FROM public.empresas WHERE id = NEW.empresa_id;

  IF v_impl IS NOT NULL THEN
    NEW.mes_reajuste := EXTRACT(MONTH FROM v_impl)::smallint;
  ELSIF NEW.mes_reajuste IS NULL AND NEW.data_aplicacao IS NOT NULL THEN
    NEW.mes_reajuste := EXTRACT(MONTH FROM NEW.data_aplicacao)::smallint;
  END IF;

  IF NEW.data_aplicacao IS NOT NULL AND NEW.mes_reajuste IS NOT NULL THEN
    v_mes_aplic := EXTRACT(MONTH FROM NEW.data_aplicacao)::int;
    v_ano_aplic := EXTRACT(YEAR FROM NEW.data_aplicacao)::int;
    IF v_mes_aplic = NEW.mes_reajuste THEN
      -- Aplicado no próprio mês de reajuste: cobra do mês de reajuste até hoje
      v_diff := (EXTRACT(YEAR FROM CURRENT_DATE)::int - v_ano_aplic) * 12
              + (EXTRACT(MONTH FROM CURRENT_DATE)::int - NEW.mes_reajuste);
    ELSE
      v_diff := v_mes_aplic - NEW.mes_reajuste;
    END IF;
    IF v_diff < 0 THEN v_diff := 0; END IF;
    NEW.meses_retroativos := v_diff;
  END IF;

  v_enf_antigo := COALESCE(NEW.valor_antigo_enfermaria_centavos, 0);
  v_apt_antigo := COALESCE(NEW.valor_antigo_apartamento_centavos, 0);

  IF NOT v_usa_faixa_enf THEN
    IF NEW.percentual IS NOT NULL AND NEW.percentual > 0 AND v_enf_antigo > 0 THEN
      NEW.valor_reajustado_enfermaria_centavos :=
        ROUND(v_enf_antigo + (v_enf_antigo * NEW.percentual / 100.0))::bigint;
    END IF;
    NEW.valor_retroativo_enfermaria_centavos :=
      GREATEST(0, COALESCE(NEW.valor_reajustado_enfermaria_centavos,0) - v_enf_antigo)
      * COALESCE(NEW.meses_retroativos, 0);
    NEW.valor_final_enfermaria_centavos :=
      COALESCE(NEW.valor_reajustado_enfermaria_centavos,0) + COALESCE(NEW.valor_retroativo_enfermaria_centavos,0);
  END IF;

  IF NOT v_usa_faixa_apt THEN
    IF NEW.percentual IS NOT NULL AND NEW.percentual > 0 AND v_apt_antigo > 0 THEN
      NEW.valor_reajustado_apartamento_centavos :=
        ROUND(v_apt_antigo + (v_apt_antigo * NEW.percentual / 100.0))::bigint;
    END IF;
    NEW.valor_retroativo_apartamento_centavos :=
      GREATEST(0, COALESCE(NEW.valor_reajustado_apartamento_centavos,0) - v_apt_antigo)
      * COALESCE(NEW.meses_retroativos, 0);
    NEW.valor_final_apartamento_centavos :=
      COALESCE(NEW.valor_reajustado_apartamento_centavos,0) + COALESCE(NEW.valor_retroativo_apartamento_centavos,0);
  END IF;

  IF v_enf_antigo > 0 OR v_apt_antigo > 0 THEN
    NEW.valor_antigo_centavos := v_enf_antigo + v_apt_antigo;
    NEW.valor_reajustado_centavos :=
      COALESCE(NEW.valor_reajustado_enfermaria_centavos,0) + COALESCE(NEW.valor_reajustado_apartamento_centavos,0);
  ELSE
    IF NEW.valor_antigo_centavos IS NOT NULL AND NEW.valor_antigo_centavos > 0
       AND NEW.percentual IS NOT NULL AND NEW.percentual > 0 THEN
      NEW.valor_reajustado_centavos :=
        ROUND(NEW.valor_antigo_centavos + (NEW.valor_antigo_centavos * NEW.percentual / 100.0))::bigint;
    END IF;
  END IF;

  IF NEW.valor_reajustado_centavos IS NOT NULL AND NEW.valor_antigo_centavos IS NOT NULL THEN
    NEW.valor_retroativo_centavos :=
      ((NEW.valor_reajustado_centavos - NEW.valor_antigo_centavos) * COALESCE(NEW.meses_retroativos, 0))::bigint;
  END IF;

  NEW.valor_final_centavos :=
    COALESCE(NEW.valor_reajustado_centavos, 0) + COALESCE(NEW.valor_retroativo_centavos, 0);

  RETURN NEW;
END;
$function$;

-- Recalcula reajustes existentes onde mês de aplicação == mês de reajuste
UPDATE public.reajustes_anuais
SET data_aplicacao = data_aplicacao
WHERE data_aplicacao IS NOT NULL
  AND mes_reajuste IS NOT NULL
  AND EXTRACT(MONTH FROM data_aplicacao)::int = mes_reajuste;