CREATE OR REPLACE FUNCTION public.normalizar_periodo_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp public.empresas%ROWTYPE;
  v_periodo text;
  v_exists uuid;
BEGIN
  IF COALESCE(NEW.tipo_lancamento, 'normal') NOT IN ('normal', 'primeira_mensalidade', 'fechamento_periodo') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_emp FROM public.empresas WHERE id = NEW.empresa_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_periodo := public._periodo_para_empresa(v_emp);

  IF v_periodo IS NOT NULL AND v_periodo <> '' THEN
    NEW.periodo := v_periodo;
  END IF;

  -- Duplicidade apenas dentro do MESMO tipo de lançamento:
  -- permite conviver "primeira_mensalidade" + cobrança normal na mesma competência.
  SELECT id INTO v_exists
  FROM public.financeiro_movimentacoes
  WHERE empresa_id = NEW.empresa_id
    AND mes_referencia = NEW.mes_referencia
    AND COALESCE(tipo_lancamento, 'normal') = COALESCE(NEW.tipo_lancamento, 'normal')
    AND (NEW.id IS NULL OR id <> NEW.id)
  LIMIT 1;

  IF v_exists IS NOT NULL THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;