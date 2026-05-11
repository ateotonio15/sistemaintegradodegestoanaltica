
-- Tornar valores nullable para permitir solicitação sem valores
ALTER TABLE public.reajustes_anuais
  ALTER COLUMN valor_antigo_centavos DROP NOT NULL,
  ALTER COLUMN valor_reajustado_centavos DROP NOT NULL,
  ALTER COLUMN percentual DROP NOT NULL,
  ALTER COLUMN data_aplicacao DROP NOT NULL;

-- Alterar default do status para suportar 'solicitado'
ALTER TABLE public.reajustes_anuais
  ALTER COLUMN status_reajuste SET DEFAULT 'solicitado';

-- Atualizar trigger de cálculo para tratar nulos
CREATE OR REPLACE FUNCTION public.trg_reajuste_calc_campos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_impl date;
  v_mes_aplic int;
  v_diff int;
BEGIN
  SELECT data_implantacao INTO v_impl FROM public.empresas WHERE id = NEW.empresa_id;

  IF v_impl IS NOT NULL THEN
    NEW.mes_reajuste := EXTRACT(MONTH FROM v_impl)::smallint;
  ELSIF NEW.mes_reajuste IS NULL AND NEW.data_aplicacao IS NOT NULL THEN
    NEW.mes_reajuste := EXTRACT(MONTH FROM NEW.data_aplicacao)::smallint;
  END IF;

  -- Só calcula valor reajustado se houver valor_antigo e percentual válidos
  IF NEW.valor_antigo_centavos IS NOT NULL AND NEW.valor_antigo_centavos > 0
     AND NEW.percentual IS NOT NULL AND NEW.percentual > 0 THEN
    NEW.valor_reajustado_centavos :=
      ROUND(NEW.valor_antigo_centavos + (NEW.valor_antigo_centavos * NEW.percentual / 100.0))::bigint;
  END IF;

  IF NEW.data_aplicacao IS NOT NULL AND NEW.mes_reajuste IS NOT NULL THEN
    v_mes_aplic := EXTRACT(MONTH FROM NEW.data_aplicacao)::int;
    v_diff := v_mes_aplic - NEW.mes_reajuste;
    IF v_diff < 0 THEN v_diff := 0; END IF;
    NEW.meses_retroativos := v_diff;
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

-- Atualizar trigger de criação de alerta para também disparar em 'solicitado'
CREATE OR REPLACE FUNCTION public.trg_criar_alerta_reajuste()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_nome text;
  v_responsavel uuid;
  v_user_nome text;
BEGIN
  IF NEW.status_reajuste NOT IN ('pendente_confirmacao','solicitado') THEN
    RETURN NEW;
  END IF;

  SELECT nome, responsavel_user_id INTO v_empresa_nome, v_responsavel
    FROM public.empresas WHERE id = NEW.empresa_id;

  IF v_empresa_nome IS NULL THEN RETURN NEW; END IF;

  SELECT display_name INTO v_user_nome
    FROM public.profiles WHERE user_id = NEW.usuario_id;

  INSERT INTO public.alertas_reajuste
    (reajuste_id, empresa_id, empresa_nome, criado_por_user_id, criado_por_nome, destinatario_user_id, status)
  VALUES
    (NEW.id, NEW.empresa_id, v_empresa_nome, NEW.usuario_id, COALESCE(v_user_nome, NEW.usuario_nome), v_responsavel, 'Pendente');

  RETURN NEW;
END;
$function$;

-- RPC para Visualização solicitar reajuste
CREATE OR REPLACE FUNCTION public.solicitar_reajuste(p_empresa_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa record;
  v_user_nome text;
  v_id uuid;
  v_ano int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (public.has_role(v_uid, 'visualizacao'::app_role) OR public.has_role(v_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Visualização ou Admin podem solicitar reajuste';
  END IF;

  SELECT id, nome INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  -- Verifica se já existe reajuste no ano (qualquer status)
  IF EXISTS (SELECT 1 FROM public.reajustes_anuais WHERE empresa_id = p_empresa_id AND ano = v_ano) THEN
    RAISE EXCEPTION 'Já existe um reajuste/solicitação para esta empresa em %', v_ano;
  END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.reajustes_anuais
    (empresa_id, ano, status_reajuste, status, valor_antigo_centavos, percentual,
     valor_reajustado_centavos, data_aplicacao, usuario_id, usuario_nome,
     meses_retroativos, valor_retroativo_centavos, valor_final_centavos)
  VALUES
    (p_empresa_id, v_ano, 'solicitado', 'Solicitado', 0, 0, 0, NULL, v_uid, v_user_nome, 0, 0, 0)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
