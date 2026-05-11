
ALTER TABLE public.reajustes_anuais
  ADD COLUMN IF NOT EXISTS mes_reajuste smallint,
  ADD COLUMN IF NOT EXISTS meses_retroativos smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_retroativo_centavos bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_final_centavos bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS competencia text,
  ADD COLUMN IF NOT EXISTS data_liberacao timestamptz,
  ADD COLUMN IF NOT EXISTS liberado_por uuid,
  ADD COLUMN IF NOT EXISTS liberado_por_nome text;

-- Trigger de cálculo automático
CREATE OR REPLACE FUNCTION public.trg_reajuste_calc_campos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_impl date;
  v_mes_aplic int;
  v_diff int;
BEGIN
  -- Buscar data de implantação para definir mes_reajuste oficial
  SELECT data_implantacao INTO v_impl FROM public.empresas WHERE id = NEW.empresa_id;

  IF v_impl IS NOT NULL THEN
    NEW.mes_reajuste := EXTRACT(MONTH FROM v_impl)::smallint;
  ELSIF NEW.mes_reajuste IS NULL AND NEW.data_aplicacao IS NOT NULL THEN
    NEW.mes_reajuste := EXTRACT(MONTH FROM NEW.data_aplicacao)::smallint;
  END IF;

  -- Recalcular valor_reajustado em SQL (autoritativo)
  IF NEW.valor_antigo_centavos IS NOT NULL AND NEW.percentual IS NOT NULL THEN
    NEW.valor_reajustado_centavos :=
      ROUND(NEW.valor_antigo_centavos + (NEW.valor_antigo_centavos * NEW.percentual / 100.0))::bigint;
  END IF;

  -- Meses retroativos = (mes_aplicacao - mes_reajuste) dentro do mesmo ano (>=0)
  IF NEW.data_aplicacao IS NOT NULL AND NEW.mes_reajuste IS NOT NULL THEN
    v_mes_aplic := EXTRACT(MONTH FROM NEW.data_aplicacao)::int;
    v_diff := v_mes_aplic - NEW.mes_reajuste;
    IF v_diff < 0 THEN v_diff := 0; END IF;
    NEW.meses_retroativos := v_diff;
  END IF;

  -- Valor retroativo = (reajustado - antigo) * meses_retroativos
  IF NEW.valor_reajustado_centavos IS NOT NULL AND NEW.valor_antigo_centavos IS NOT NULL THEN
    NEW.valor_retroativo_centavos :=
      ((NEW.valor_reajustado_centavos - NEW.valor_antigo_centavos) * COALESCE(NEW.meses_retroativos, 0))::bigint;
  END IF;

  -- Valor final = reajustado + retroativo
  NEW.valor_final_centavos :=
    COALESCE(NEW.valor_reajustado_centavos, 0) + COALESCE(NEW.valor_retroativo_centavos, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reajuste_calc_campos ON public.reajustes_anuais;
CREATE TRIGGER trg_reajuste_calc_campos
  BEFORE INSERT OR UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_reajuste_calc_campos();

-- Atualizar guard do Comum para também proteger novos campos (exceto confirmação)
CREATE OR REPLACE FUNCTION public.guard_reajuste_comum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF public.has_role(v_uid, 'comum'::app_role)
     AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.ano IS DISTINCT FROM OLD.ano
       OR NEW.valor_antigo_centavos IS DISTINCT FROM OLD.valor_antigo_centavos
       OR NEW.percentual IS DISTINCT FROM OLD.percentual
       OR NEW.valor_reajustado_centavos IS DISTINCT FROM OLD.valor_reajustado_centavos
       OR NEW.data_aplicacao IS DISTINCT FROM OLD.data_aplicacao
       OR NEW.observacao IS DISTINCT FROM OLD.observacao
       OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
       OR NEW.usuario_nome IS DISTINCT FROM OLD.usuario_nome
       OR NEW.mes_reajuste IS DISTINCT FROM OLD.mes_reajuste
       OR NEW.meses_retroativos IS DISTINCT FROM OLD.meses_retroativos
       OR NEW.valor_retroativo_centavos IS DISTINCT FROM OLD.valor_retroativo_centavos
       OR NEW.valor_final_centavos IS DISTINCT FROM OLD.valor_final_centavos
       OR NEW.competencia IS DISTINCT FROM OLD.competencia
       OR NEW.data_liberacao IS DISTINCT FROM OLD.data_liberacao
       OR NEW.liberado_por IS DISTINCT FROM OLD.liberado_por
       OR NEW.liberado_por_nome IS DISTINCT FROM OLD.liberado_por_nome THEN
      RAISE EXCEPTION 'Cadastro só pode confirmar reajustes (não pode alterar valores ou liberação)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
