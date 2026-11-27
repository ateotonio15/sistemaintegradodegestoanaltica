ALTER TABLE public.uber_corridas ADD COLUMN servico_uber text;
ALTER TABLE public.uber_importacoes ADD COLUMN servicos_atualizados integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.uber_importacao_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.uber_trip_id IS DISTINCT FROM OLD.uber_trip_id OR NEW.importacao_id IS DISTINCT FROM OLD.importacao_id OR NEW.setor_solicitante IS DISTINCT FROM OLD.setor_solicitante THEN RAISE EXCEPTION 'Identidade da importação não pode ser alterada'; END IF;
  IF NEW.servico_uber IS DISTINCT FROM OLD.servico_uber AND (to_jsonb(NEW)-'servico_uber'-'updated_at') = (to_jsonb(OLD)-'servico_uber'-'updated_at') THEN
   NEW.updated_at:=OLD.updated_at;
   RETURN NEW;
  END IF;
 END IF;
 IF NEW.uber_trip_id IS NOT NULL THEN
  IF TG_OP='INSERT' AND NEW.importacao_id IS NOT NULL AND current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Use a confirmação de importação'; END IF;
  IF NOT coalesce(NEW.cancelada,false) THEN
   NEW.status_importacao:=CASE WHEN nullif(trim(NEW.colaborador),'') IS NULL OR nullif(trim(NEW.empresa),'') IS NULL OR nullif(trim(NEW.motivo),'') IS NULL OR nullif(trim(NEW.tipo),'') IS NULL OR nullif(trim(NEW.forma_pagamento),'') IS NULL THEN 'pendente' ELSE 'completa' END;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.uber_confirmar_importacao(p_lote uuid,p_arquivos jsonb,p_linhas jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_nome text; v_row jsonb; v_id uuid; v_importadas integer:=0; v_ignoradas integer:=0; v_atualizadas integer:=0; v_total integer; v_arquivo jsonb; v_stats jsonb:='[]'; v_qtd integer; v_servico text; v_existente public.uber_corridas%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo')) THEN RAISE EXCEPTION 'Sem permissão para importar'; END IF;
 IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array' OR jsonb_typeof(p_arquivos) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Importação inválida'; END IF;
 IF jsonb_array_length(p_linhas)>10000 OR jsonb_array_length(p_arquivos)>20 OR jsonb_array_length(p_arquivos)=0 THEN RAISE EXCEPTION 'Limite de importação excedido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('uber-business-import'));
 IF EXISTS(SELECT 1 FROM public.uber_importacoes WHERE id=p_lote) THEN
  RETURN (SELECT jsonb_build_object('importadas',importadas,'ignoradas',ignoradas,'servicos_atualizados',servicos_atualizados) FROM public.uber_importacoes WHERE id=p_lote AND (usuario_id=auth.uid() OR public.has_role(auth.uid(),'admin')));
 END IF;
 SELECT coalesce(display_name,username,'Usuário') INTO v_nome FROM public.profiles WHERE user_id=auth.uid();
 INSERT INTO public.uber_importacoes(id,usuario_id,usuario_nome,arquivos) VALUES(p_lote,auth.uid(),coalesce(v_nome,'Usuário'),p_arquivos);
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_linhas) LOOP
  IF nullif(trim(v_row->>'uber_trip_id'),'') IS NULL THEN RAISE EXCEPTION 'ID da viagem obrigatório'; END IF;
  v_servico:=v_row->>'servico_uber';
  IF starts_with(v_servico,'Travel | ') THEN v_servico:=substr(v_servico,10); END IF;
  IF nullif(trim(v_servico),'') IS NULL THEN v_servico:=NULL; END IF;
  SELECT * INTO v_existente FROM public.uber_corridas WHERE uber_trip_id=v_row->>'uber_trip_id' FOR UPDATE;
  IF FOUND THEN
   IF v_existente.importacao_id IS NOT NULL AND nullif(trim(v_existente.servico_uber),'') IS NULL AND v_servico IS NOT NULL THEN
    UPDATE public.uber_corridas SET servico_uber=v_servico WHERE id=v_existente.id AND nullif(trim(servico_uber),'') IS NULL;
    GET DIAGNOSTICS v_qtd=ROW_COUNT;
    v_atualizadas:=v_atualizadas+v_qtd;
   ELSE v_ignoradas:=v_ignoradas+1;
   END IF;
   CONTINUE;
  END IF;
  IF nullif(v_row->>'colaborador','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.uber_passageiros WHERE id=nullif(v_row->>'passageiro_id','')::uuid AND ativo AND nome=v_row->>'colaborador') THEN RAISE EXCEPTION 'Selecione um passageiro ativo cadastrado'; END IF;
  v_id:=NULL;
  INSERT INTO public.uber_corridas(data,horario,colaborador,passageiro_id,origem,destino,motivo,tipo,empresa,forma_pagamento,responsavel,criado_por,created_by,valor,cancelada,uber_trip_id,setor_solicitante,importacao_id,servico_uber)
  VALUES((v_row->>'data')::date,nullif(v_row->>'horario','')::time,coalesce(v_row->>'colaborador',''),nullif(v_row->>'passageiro_id','')::uuid,v_row->>'origem',v_row->>'destino',nullif(v_row->>'motivo',''),nullif(v_row->>'tipo',''),nullif(v_row->>'empresa',''),nullif(v_row->>'forma_pagamento',''),nullif(v_row->>'responsavel',''),v_nome,auth.uid(),(v_row->>'valor')::numeric,coalesce((v_row->>'cancelada')::boolean,false),v_row->>'uber_trip_id',v_row->>'setor_solicitante',p_lote,v_servico)
  ON CONFLICT(uber_trip_id) WHERE uber_trip_id IS NOT NULL DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN v_ignoradas:=v_ignoradas+1; ELSE v_importadas:=v_importadas+1; END IF;
 END LOOP;
 FOR v_arquivo IN SELECT value FROM jsonb_array_elements(p_arquivos) LOOP
  SELECT count(*) INTO v_qtd FROM public.uber_corridas c WHERE c.importacao_id=p_lote AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_linhas) r WHERE r->>'uber_trip_id'=c.uber_trip_id AND (r->'arquivos') ? (v_arquivo->>'nome'));
  v_total:=coalesce((v_arquivo->>'viagens')::integer,0);
  v_stats:=v_stats || jsonb_build_array(jsonb_build_object('nome',v_arquivo->>'nome','importadas',v_qtd,'ignoradas',greatest(v_total-v_qtd,0)));
 END LOOP;
 SELECT coalesce(sum((value->>'viagens')::integer),0) INTO v_total FROM jsonb_array_elements(p_arquivos);
 UPDATE public.uber_importacoes SET importadas=v_importadas,ignoradas=greatest(v_total-v_importadas-v_atualizadas,0),servicos_atualizados=v_atualizadas,arquivos=v_stats WHERE id=p_lote;
 RETURN jsonb_build_object('importadas',v_importadas,'ignoradas',v_ignoradas,'servicos_atualizados',v_atualizadas);
END $$;