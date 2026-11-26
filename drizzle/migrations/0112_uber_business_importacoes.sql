ALTER TABLE public.uber_corridas ADD COLUMN uber_trip_id text, ADD COLUMN setor_solicitante text, ADD COLUMN importacao_id uuid, ADD COLUMN status_importacao text CHECK (status_importacao IN ('pendente','completa'));
CREATE UNIQUE INDEX uber_corridas_trip_id_unique ON public.uber_corridas(uber_trip_id) WHERE uber_trip_id IS NOT NULL;
CREATE TABLE public.uber_importacoes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid NOT NULL, usuario_nome text NOT NULL, arquivos jsonb NOT NULL, importadas integer NOT NULL DEFAULT 0, ignoradas integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), desfeita_em timestamptz, removidas integer);
GRANT SELECT ON public.uber_importacoes TO authenticated;
GRANT ALL ON public.uber_importacoes TO service_role;
ALTER TABLE public.uber_importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY uber_importacoes_leitura ON public.uber_importacoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR (usuario_id=auth.uid() AND public.has_role(auth.uid(),'executivo')));
ALTER TABLE public.uber_corridas ADD CONSTRAINT uber_corridas_importacao_fk FOREIGN KEY (importacao_id) REFERENCES public.uber_importacoes(id);
CREATE FUNCTION public.uber_importacao_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.uber_trip_id IS DISTINCT FROM OLD.uber_trip_id OR NEW.importacao_id IS DISTINCT FROM OLD.importacao_id OR NEW.setor_solicitante IS DISTINCT FROM OLD.setor_solicitante) THEN RAISE EXCEPTION 'Identidade da importação não pode ser alterada'; END IF;
 IF NEW.importacao_id IS NOT NULL THEN
  IF TG_OP='INSERT' AND current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Use a confirmação de importação'; END IF;
  NEW.status_importacao := CASE WHEN nullif(trim(NEW.colaborador),'') IS NULL THEN 'pendente' ELSE 'completa' END;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER uber_importacao_guard BEFORE INSERT OR UPDATE ON public.uber_corridas FOR EACH ROW EXECUTE FUNCTION public.uber_importacao_guard();
CREATE FUNCTION public.uber_confirmar_importacao(p_lote uuid,p_arquivos jsonb,p_linhas jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_nome text; v_row jsonb; v_id uuid; v_importadas integer:=0; v_ignoradas integer:=0; v_total integer; v_arquivo jsonb; v_stats jsonb:='[]'; v_qtd integer;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo')) THEN RAISE EXCEPTION 'Sem permissão para importar'; END IF;
 IF jsonb_typeof(p_linhas) IS DISTINCT FROM 'array' OR jsonb_typeof(p_arquivos) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Importação inválida'; END IF;
 IF jsonb_array_length(p_linhas)>10000 OR jsonb_array_length(p_arquivos)>20 OR jsonb_array_length(p_arquivos)=0 THEN RAISE EXCEPTION 'Limite de importação excedido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('uber-business-import'));
 IF EXISTS(SELECT 1 FROM public.uber_importacoes WHERE id=p_lote) THEN
  RETURN (SELECT jsonb_build_object('importadas',importadas,'ignoradas',ignoradas) FROM public.uber_importacoes WHERE id=p_lote AND (usuario_id=auth.uid() OR public.has_role(auth.uid(),'admin')));
 END IF;
 SELECT coalesce(display_name,username,'Usuário') INTO v_nome FROM public.profiles WHERE user_id=auth.uid();
 INSERT INTO public.uber_importacoes(id,usuario_id,usuario_nome,arquivos) VALUES(p_lote,auth.uid(),coalesce(v_nome,'Usuário'),p_arquivos);
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_linhas) LOOP
  IF nullif(trim(v_row->>'uber_trip_id'),'') IS NULL THEN RAISE EXCEPTION 'ID da viagem obrigatório'; END IF;
  IF nullif(v_row->>'colaborador','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.uber_passageiros WHERE id=nullif(v_row->>'passageiro_id','')::uuid AND ativo AND nome=v_row->>'colaborador') THEN RAISE EXCEPTION 'Selecione um passageiro ativo cadastrado'; END IF;
  v_id:=NULL;
  INSERT INTO public.uber_corridas(data,horario,colaborador,passageiro_id,origem,destino,motivo,tipo,empresa,forma_pagamento,responsavel,criado_por,created_by,valor,cancelada,uber_trip_id,setor_solicitante,importacao_id)
  VALUES((v_row->>'data')::date,nullif(v_row->>'horario','')::time,coalesce(v_row->>'colaborador',''),nullif(v_row->>'passageiro_id','')::uuid,v_row->>'origem',v_row->>'destino',nullif(v_row->>'motivo',''),nullif(v_row->>'tipo',''),nullif(v_row->>'empresa',''),nullif(v_row->>'forma_pagamento',''),nullif(v_row->>'responsavel',''),v_nome,auth.uid(),(v_row->>'valor')::numeric,coalesce((v_row->>'cancelada')::boolean,false),v_row->>'uber_trip_id',v_row->>'setor_solicitante',p_lote)
  ON CONFLICT(uber_trip_id) WHERE uber_trip_id IS NOT NULL DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN v_ignoradas:=v_ignoradas+1; ELSE v_importadas:=v_importadas+1; END IF;
 END LOOP;
 FOR v_arquivo IN SELECT value FROM jsonb_array_elements(p_arquivos) LOOP
  SELECT count(*) INTO v_qtd FROM public.uber_corridas c WHERE c.importacao_id=p_lote AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_linhas) r WHERE r->>'uber_trip_id'=c.uber_trip_id AND (r->'arquivos') ? (v_arquivo->>'nome'));
  v_total:=coalesce((v_arquivo->>'viagens')::integer,0);
  v_stats:=v_stats || jsonb_build_array(jsonb_build_object('nome',v_arquivo->>'nome','importadas',v_qtd,'ignoradas',greatest(v_total-v_qtd,0)));
 END LOOP;
 SELECT coalesce(sum((value->>'viagens')::integer),0) INTO v_total FROM jsonb_array_elements(p_arquivos);
 UPDATE public.uber_importacoes SET importadas=v_importadas,ignoradas=greatest(v_total-v_importadas,0),arquivos=v_stats WHERE id=p_lote;
 RETURN jsonb_build_object('importadas',v_importadas,'ignoradas',v_ignoradas);
END $$;
REVOKE ALL ON FUNCTION public.uber_confirmar_importacao(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.uber_confirmar_importacao(uuid,jsonb,jsonb) TO authenticated;
CREATE FUNCTION public.uber_desfazer_importacao(p_lote uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_lote public.uber_importacoes%ROWTYPE; v_qtd integer;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 SELECT * INTO v_lote FROM public.uber_importacoes WHERE id=p_lote FOR UPDATE;
 IF NOT FOUND OR NOT (v_lote.usuario_id=auth.uid() OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Importação não autorizada'; END IF;
 IF v_lote.desfeita_em IS NOT NULL THEN RETURN 0; END IF;
 DELETE FROM public.uber_corridas WHERE importacao_id=p_lote;
 GET DIAGNOSTICS v_qtd=ROW_COUNT;
 UPDATE public.uber_importacoes SET desfeita_em=now(),removidas=v_qtd WHERE id=p_lote;
 RETURN v_qtd;
END $$;
REVOKE ALL ON FUNCTION public.uber_desfazer_importacao(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.uber_desfazer_importacao(uuid) TO authenticated;