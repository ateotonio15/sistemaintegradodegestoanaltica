CREATE OR REPLACE FUNCTION public.validar_movimentacao_relatorio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF NEW.status IN ('Enviado','Conferido pela empresa','Divergência informada') OR NEW.confirmacao <> 'Aguardando' THEN
   IF NEW.data_envio IS NULL OR btrim(NEW.destinatarios) = '' THEN RAISE EXCEPTION 'Informe destinatários e data de envio'; END IF;
 END IF;
 IF NEW.confirmacao <> 'Aguardando' AND NEW.status <> NEW.confirmacao THEN RAISE EXCEPTION 'Confirmação incompatível com o status do relatório'; END IF;
 IF NEW.status IN ('Conferido pela empresa','Divergência informada') AND NEW.confirmacao <> NEW.status THEN RAISE EXCEPTION 'Confirmação incompatível com o status do relatório'; END IF;
 -- Quando o registro vem do servidor (envio de e-mail), auth.uid() é nulo: mantém o responsável informado.
 NEW.atualizado_por := COALESCE(auth.uid(), NEW.atualizado_por);
 NEW.atualizado_em := now();
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.registrar_envio_relatorio_concluido(p_envio_id uuid, p_principal uuid, p_movimentacoes uuid[], p_usuario uuid, p_nome text, p_destinatarios text, p_cc text, p_contrato text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_agora timestamptz := clock_timestamp(); v_hoje date := (v_agora AT TIME ZONE 'America/Manaus')::date;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = p_usuario AND role IN ('admin','comum','administradoras')) THEN RAISE EXCEPTION 'Sem permissao para registrar envio'; END IF;
 IF NOT p_principal = ANY(p_movimentacoes) OR cardinality(p_movimentacoes) = 0 THEN RAISE EXCEPTION 'Movimentacoes invalidas'; END IF;
 FOR v_id IN SELECT DISTINCT unnest(p_movimentacoes) ORDER BY 1 LOOP
  PERFORM 1 FROM public.movimentacoes WHERE id = v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimentacao nao encontrada'; END IF;
  IF EXISTS(SELECT 1 FROM public.movimentacao_relatorio_envios WHERE envio_id = p_envio_id AND movimentacao_id = v_id) THEN CONTINUE; END IF;
  INSERT INTO public.movimentacao_relatorio_envios(envio_id,movimentacao_id,principal_movimentacao_id,enviado_em,enviado_por,nome_remetente) VALUES(p_envio_id,v_id,p_principal,v_agora,p_usuario,NULLIF(trim(p_nome),''));
  INSERT INTO public.movimentacao_relatorios(movimentacao_id,status,destinatarios,cc,data_envio,confirmacao,observacoes,atualizado_por) VALUES(v_id,'Enviado',p_destinatarios,p_cc,v_hoje,'Aguardando',CASE WHEN v_id <> p_principal THEN 'Enviado junto com o contrato principal #' || p_contrato ELSE '' END,p_usuario)
  ON CONFLICT(movimentacao_id) DO UPDATE SET status='Enviado',destinatarios=EXCLUDED.destinatarios,cc=EXCLUDED.cc,data_envio=EXCLUDED.data_envio,confirmacao='Aguardando',observacoes=CASE WHEN v_id <> p_principal THEN EXCLUDED.observacoes ELSE movimentacao_relatorios.observacoes END,atualizado_por=p_usuario;
  UPDATE public.movimentacoes SET data_envio_empresa=v_hoje WHERE id=v_id AND data_envio_empresa IS NULL;
 END LOOP;
END; $function$;