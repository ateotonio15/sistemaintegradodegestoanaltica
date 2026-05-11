
-- Adiciona campos separados Enfermaria/Apartamento em reajustes_anuais
ALTER TABLE public.reajustes_anuais
  ADD COLUMN IF NOT EXISTS valor_antigo_enfermaria_centavos      bigint,
  ADD COLUMN IF NOT EXISTS valor_reajustado_enfermaria_centavos  bigint,
  ADD COLUMN IF NOT EXISTS valor_retroativo_enfermaria_centavos  bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_final_enfermaria_centavos       bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_antigo_apartamento_centavos     bigint,
  ADD COLUMN IF NOT EXISTS valor_reajustado_apartamento_centavos bigint,
  ADD COLUMN IF NOT EXISTS valor_retroativo_apartamento_centavos bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_final_apartamento_centavos      bigint NOT NULL DEFAULT 0;

-- Atualiza trigger de cálculo para incluir Enfermaria/Apartamento
CREATE OR REPLACE FUNCTION public.trg_reajuste_calc_campos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_impl date;
  v_mes_aplic int;
  v_diff int;
  v_enf_antigo bigint;
  v_apt_antigo bigint;
BEGIN
  SELECT data_implantacao INTO v_impl FROM public.empresas WHERE id = NEW.empresa_id;

  IF v_impl IS NOT NULL THEN
    NEW.mes_reajuste := EXTRACT(MONTH FROM v_impl)::smallint;
  ELSIF NEW.mes_reajuste IS NULL AND NEW.data_aplicacao IS NOT NULL THEN
    NEW.mes_reajuste := EXTRACT(MONTH FROM NEW.data_aplicacao)::smallint;
  END IF;

  IF NEW.data_aplicacao IS NOT NULL AND NEW.mes_reajuste IS NOT NULL THEN
    v_mes_aplic := EXTRACT(MONTH FROM NEW.data_aplicacao)::int;
    v_diff := v_mes_aplic - NEW.mes_reajuste;
    IF v_diff < 0 THEN v_diff := 0; END IF;
    NEW.meses_retroativos := v_diff;
  END IF;

  v_enf_antigo := COALESCE(NEW.valor_antigo_enfermaria_centavos, 0);
  v_apt_antigo := COALESCE(NEW.valor_antigo_apartamento_centavos, 0);

  -- Calcula reajustado por categoria com o mesmo percentual
  IF NEW.percentual IS NOT NULL AND NEW.percentual > 0 THEN
    IF v_enf_antigo > 0 THEN
      NEW.valor_reajustado_enfermaria_centavos :=
        ROUND(v_enf_antigo + (v_enf_antigo * NEW.percentual / 100.0))::bigint;
    END IF;
    IF v_apt_antigo > 0 THEN
      NEW.valor_reajustado_apartamento_centavos :=
        ROUND(v_apt_antigo + (v_apt_antigo * NEW.percentual / 100.0))::bigint;
    END IF;
  END IF;

  -- Retroativo por categoria
  NEW.valor_retroativo_enfermaria_centavos :=
    GREATEST(0, COALESCE(NEW.valor_reajustado_enfermaria_centavos,0) - v_enf_antigo)
    * COALESCE(NEW.meses_retroativos, 0);
  NEW.valor_retroativo_apartamento_centavos :=
    GREATEST(0, COALESCE(NEW.valor_reajustado_apartamento_centavos,0) - v_apt_antigo)
    * COALESCE(NEW.meses_retroativos, 0);

  -- Valor final por categoria
  NEW.valor_final_enfermaria_centavos :=
    COALESCE(NEW.valor_reajustado_enfermaria_centavos,0) + COALESCE(NEW.valor_retroativo_enfermaria_centavos,0);
  NEW.valor_final_apartamento_centavos :=
    COALESCE(NEW.valor_reajustado_apartamento_centavos,0) + COALESCE(NEW.valor_retroativo_apartamento_centavos,0);

  -- Campos legados: somatório (mantém retrocompatibilidade)
  IF v_enf_antigo > 0 OR v_apt_antigo > 0 THEN
    NEW.valor_antigo_centavos := v_enf_antigo + v_apt_antigo;
    NEW.valor_reajustado_centavos :=
      COALESCE(NEW.valor_reajustado_enfermaria_centavos,0) + COALESCE(NEW.valor_reajustado_apartamento_centavos,0);
  ELSE
    -- Sem valores Enf/Apt: mantém comportamento antigo no campo legado
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
