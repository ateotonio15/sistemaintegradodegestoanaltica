ALTER TABLE public.anexos_movimentacao ADD COLUMN repositorio_envio_id uuid;
CREATE UNIQUE INDEX anexos_repositorio_unico ON public.anexos_movimentacao (movimentacao_id, repositorio_envio_id) WHERE repositorio_envio_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.registrar_documento_fechamento(p_movimentacao uuid, p_usuario uuid, p_empresa uuid, p_contrato text, p_competencia text, p_periodo text, p_tipo text, p_nome text, p_path text, p_mime text, p_tamanho bigint) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.movimentacoes; codigo text; atual uuid; nome_usuario text;
BEGIN
 IF p_usuario IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_usuario AND role IN ('admin','comum','administradoras','financeiro')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 SELECT * INTO STRICT m FROM public.movimentacoes WHERE id=p_movimentacao FOR SHARE;
 SELECT codigo_contrato::text INTO codigo FROM public.empresas WHERE id=m.empresa_id;
 IF m.empresa_id<>p_empresa OR codigo IS DISTINCT FROM p_contrato OR m.mes_referencia IS DISTINCT FROM p_competencia OR m.periodo IS DISTINCT FROM p_periodo THEN RAISE EXCEPTION 'Contexto divergente'; END IF;
 IF p_tipo NOT IN ('Relatório de Vidas','OPS Mensalidades') OR p_tamanho<=0 OR p_tamanho>15728640 OR position('_Contrato_'||codigo||'_' IN p_nome)=0 OR position('envios/'||p_movimentacao::text||'/' IN p_path)<>1 THEN RAISE EXCEPTION 'Documento inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|',p_empresa,codigo,p_competencia,coalesce(p_periodo,''),p_tipo),0));
 SELECT id INTO atual FROM public.envios_empresa_arquivos WHERE empresa_id=p_empresa AND contrato=codigo AND competencia=p_competencia AND periodo IS NOT DISTINCT FROM p_periodo AND tipo_relatorio=p_tipo AND lower(status)='atual' ORDER BY versao DESC LIMIT 1;
 IF atual IS NOT NULL THEN RETURN atual; END IF;
 SELECT coalesce(display_name,username,'Usuário') INTO nome_usuario FROM public.profiles WHERE user_id=p_usuario LIMIT 1;
 INSERT INTO public.envios_empresa_arquivos(envio_id,movimentacao_id,empresa_id,contrato,competencia,periodo,nome_arquivo,bucket,storage_path,mime_type,tamanho_bytes,tipo_relatorio,enviado_por,enviado_nome,origem,versao,status)
 VALUES(gen_random_uuid(),p_movimentacao,p_empresa,codigo,p_competencia,p_periodo,p_nome,'arquivos-envios',p_path,p_mime,p_tamanho,p_tipo,p_usuario,nome_usuario,'Importação para fechamento',coalesce((SELECT max(versao) FROM public.envios_empresa_arquivos WHERE empresa_id=p_empresa AND contrato=codigo AND competencia=p_competencia AND periodo IS NOT DISTINCT FROM p_periodo AND tipo_relatorio=p_tipo),0)+1,'Atual') RETURNING id INTO atual;
 RETURN atual;
END $$;
REVOKE ALL ON FUNCTION public.registrar_documento_fechamento(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_documento_fechamento(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.validar_anexo_repositorio() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.repositorio_envio_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM public.envios_empresa_arquivos r JOIN public.movimentacoes m ON m.id=NEW.movimentacao_id JOIN public.empresas e ON e.id=m.empresa_id
 WHERE r.id=NEW.repositorio_envio_id AND r.empresa_id=m.empresa_id AND r.empresa_id=NEW.empresa_id AND r.contrato=e.codigo_contrato::text AND r.competencia=m.mes_referencia AND r.periodo IS NOT DISTINCT FROM m.periodo AND lower(r.status)='atual' AND r.nome_arquivo=NEW.nome_arquivo
 ) THEN RAISE EXCEPTION 'Versão ou contexto do repositório divergente'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validar_anexo_repositorio() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validar_anexo_repositorio BEFORE INSERT ON public.anexos_movimentacao FOR EACH ROW EXECUTE FUNCTION public.validar_anexo_repositorio();

CREATE OR REPLACE FUNCTION public.validar_historico_fechamento() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE m public.movimentacoes; codigo text;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Histórico de fechamento não pode ser alterado ou excluído.'; END IF;
 SELECT * INTO STRICT m FROM public.movimentacoes WHERE id=NEW.movimentacao_id;
 SELECT codigo_contrato::text INTO codigo FROM public.empresas WHERE id=m.empresa_id;
 NEW.contrato=coalesce(codigo,''); NEW.competencia=m.mes_referencia; NEW.periodo=m.periodo;
 NEW.usuario_id=auth.uid(); IF NEW.usuario_id IS NULL THEN RAISE EXCEPTION 'Usuário obrigatório'; END IF;
 SELECT coalesce(display_name,username,'Usuário') INTO NEW.usuario_nome FROM public.profiles WHERE user_id=NEW.usuario_id LIMIT 1;
 NEW.usuario_nome=coalesce(NEW.usuario_nome,'Usuário'); NEW.criado_em=now();
 NEW.origem=CASE WHEN EXISTS(SELECT 1 FROM public.anexos_movimentacao a WHERE a.id=NEW.anexo_id AND a.repositorio_envio_id IS NOT NULL) THEN 'Repositório de Envios' ELSE 'API / integração' END;
 IF NEW.evento='continuacao_pendente' THEN
 IF cardinality(NEW.pendencias)=0 OR NOT NEW.pendencias <@ ARRAY['Relatório de Vidas - PDF','OPS Mensalidades - Excel']::text[] THEN RAISE EXCEPTION 'Pendências inválidas'; END IF;
 NEW.anexo_id=NULL; NEW.nome_arquivo=NULL; NEW.tipo_relatorio=NULL;
 ELSIF NEW.evento<>'arquivo_importado' THEN RAISE EXCEPTION 'Evento inválido'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validar_historico_fechamento() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.registrar_envio_empresa_arquivos(p_envio_id uuid,p_usuario uuid,p_nome text,p_itens jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i jsonb; agora timestamptz:=clock_timestamp();
BEGIN
 IF p_envio_id IS NULL OR p_usuario IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_usuario AND role IN ('admin','comum','administradoras')) THEN RAISE EXCEPTION 'Envio inválido'; END IF;
 IF jsonb_typeof(p_itens)<>'array' THEN RAISE EXCEPTION 'Itens inválidos'; END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(p_itens) ORDER BY value->>'empresa_id',value->>'contrato',value->>'competencia',value->>'periodo',value->>'tipo_relatorio' LOOP
 IF NULLIF(i->>'movimentacao_id','') IS NULL OR NULLIF(i->>'empresa_id','') IS NULL OR NULLIF(i->>'storage_path','') IS NULL OR NULLIF(i->>'nome_arquivo','') IS NULL OR NULLIF(i->>'tipo_relatorio','') IS NULL THEN RAISE EXCEPTION 'Item incompleto'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.movimentacoes WHERE id=(i->>'movimentacao_id')::uuid) THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|',i->>'empresa_id',i->>'contrato',i->>'competencia',coalesce(NULLIF(i->>'periodo',''),''),i->>'tipo_relatorio'),0));
 IF EXISTS(SELECT 1 FROM public.envios_empresa_arquivos WHERE envio_id=p_envio_id AND storage_path=i->>'storage_path') THEN CONTINUE; END IF;
 UPDATE public.envios_empresa_arquivos SET status='Substituído' WHERE empresa_id=(i->>'empresa_id')::uuid AND contrato=i->>'contrato' AND competencia=i->>'competencia' AND periodo IS NOT DISTINCT FROM NULLIF(i->>'periodo','') AND tipo_relatorio=i->>'tipo_relatorio' AND lower(status)='atual';
 INSERT INTO public.envios_empresa_arquivos(envio_id,movimentacao_id,empresa_id,contrato,competencia,periodo,nome_arquivo,bucket,storage_path,mime_type,tamanho_bytes,tipo_relatorio,enviado_por,enviado_nome,enviado_em,origem,versao,status)
 VALUES(p_envio_id,(i->>'movimentacao_id')::uuid,(i->>'empresa_id')::uuid,i->>'contrato',i->>'competencia',NULLIF(i->>'periodo',''),i->>'nome_arquivo',coalesce(NULLIF(i->>'bucket',''),'arquivos-envios'),i->>'storage_path',NULLIF(i->>'mime_type',''),NULLIF(i->>'tamanho_bytes','')::bigint,i->>'tipo_relatorio',p_usuario,NULLIF(trim(coalesce(p_nome,'')),''),agora,'Envio automático por e-mail',coalesce((SELECT max(versao) FROM public.envios_empresa_arquivos WHERE empresa_id=(i->>'empresa_id')::uuid AND contrato=i->>'contrato' AND competencia=i->>'competencia' AND periodo IS NOT DISTINCT FROM NULLIF(i->>'periodo','') AND tipo_relatorio=i->>'tipo_relatorio'),0)+1,'Atual');
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.registrar_envio_empresa_arquivos(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_envio_empresa_arquivos(uuid,uuid,text,jsonb) TO service_role;