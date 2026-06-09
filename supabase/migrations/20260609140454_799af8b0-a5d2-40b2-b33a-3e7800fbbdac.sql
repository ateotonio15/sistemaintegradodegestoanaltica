
-- Inverter fluxo de Reajustes: Diretora solicita, Cadastro aprova

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

  IF NOT (
    public.has_role(v_uid, 'diretora'::app_role)
    OR public.has_role(v_uid, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas Diretora ou Admin podem solicitar reajuste';
  END IF;

  SELECT id, nome INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

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

-- Avança de "solicitado" → "aguardando_aprovacao" (Diretora envia ao Cadastro)
CREATE OR REPLACE FUNCTION public.confirmar_reajuste_cadastro(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_nome text;
BEGIN
  IF NOT (public.has_role(v_uid,'diretora'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Diretora pode enviar a solicitação ao Cadastro';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.reajustes_anuais
     SET status_reajuste = 'aguardando_aprovacao',
         confirmado_por = v_uid, confirmado_por_nome = v_nome, data_confirmacao = now(),
         updated_at = now()
   WHERE id = p_id;
  UPDATE public.alertas_reajuste SET status='Finalizado', finalizado_em=now(), updated_at=now()
   WHERE reajuste_id = p_id AND destinatario_role = 'diretora' AND status='Pendente';
  PERFORM public._criar_alerta_reajuste_role(p_id, 'comum', 'aprovacao');
  PERFORM public._log_reajuste(p_id, 'enviado_ao_cadastro', NULL, NULL);
END $function$;

-- Cadastro aprova
CREATE OR REPLACE FUNCTION public.aprovar_reajuste(p_id uuid, p_obs text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_nome text;
BEGIN
  IF NOT (public.has_role(v_uid,'comum'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Cadastro pode aprovar';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.reajustes_anuais
     SET status_reajuste = 'aprovado',
         aprovado_por_user_id = v_uid, aprovado_por_nome = v_nome, aprovado_em = now(),
         rejeitado_por_user_id = NULL, rejeitado_por_nome = NULL, rejeitado_em = NULL, motivo_rejeicao = NULL,
         updated_at = now()
   WHERE id = p_id;
  UPDATE public.alertas_reajuste SET status='Finalizado', finalizado_em=now(), updated_at=now()
   WHERE reajuste_id = p_id AND destinatario_role='comum' AND status='Pendente';
  PERFORM public._log_reajuste(p_id, 'aprovado', p_obs, NULL);
END $function$;

-- Cadastro rejeita → devolve à Diretora
CREATE OR REPLACE FUNCTION public.rejeitar_reajuste(p_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_nome text;
BEGIN
  IF NOT (public.has_role(v_uid,'comum'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Cadastro pode rejeitar';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo da rejeição é obrigatório';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.reajustes_anuais
     SET status_reajuste = 'rejeitado',
         rejeitado_por_user_id = v_uid, rejeitado_por_nome = v_nome, rejeitado_em = now(),
         motivo_rejeicao = p_motivo,
         updated_at = now()
   WHERE id = p_id;
  UPDATE public.alertas_reajuste SET status='Finalizado', finalizado_em=now(), updated_at=now()
   WHERE reajuste_id = p_id AND destinatario_role='comum' AND status='Pendente';
  PERFORM public._criar_alerta_reajuste_role(p_id, 'diretora', 'correcao');
  PERFORM public._log_reajuste(p_id, 'rejeitado', p_motivo, NULL);
END $function$;

-- Cadastro libera ao Financeiro
CREATE OR REPLACE FUNCTION public.liberar_reajuste_financeiro(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_nome text; v_retro bigint;
BEGIN
  IF NOT (public.has_role(v_uid,'comum'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Cadastro pode liberar para o Financeiro';
  END IF;
  SELECT COALESCE(valor_retroativo_centavos,0) INTO v_retro FROM public.reajustes_anuais WHERE id = p_id;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.reajustes_anuais
     SET status_reajuste = CASE WHEN COALESCE(v_retro,0) > 0 THEN 'liberado_financeiro' ELSE 'reajustado' END,
         data_liberacao = now(), liberado_por = v_uid, liberado_por_nome = v_nome,
         updated_at = now()
   WHERE id = p_id;
  IF COALESCE(v_retro,0) > 0 THEN
    PERFORM public._criar_alerta_reajuste_role(p_id, 'financeiro', 'retroativo');
    PERFORM public._log_reajuste(p_id, 'liberado_financeiro', NULL, NULL);
  ELSE
    PERFORM public._log_reajuste(p_id, 'reajustado', NULL, NULL);
  END IF;
END $function$;
