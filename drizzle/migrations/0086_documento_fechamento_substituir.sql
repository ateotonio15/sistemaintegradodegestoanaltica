DROP FUNCTION IF EXISTS public.registrar_documento_fechamento(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint);
CREATE OR REPLACE FUNCTION public.registrar_documento_fechamento(p_movimentacao uuid, p_usuario uuid, p_empresa uuid, p_contrato text, p_competencia text, p_periodo text, p_tipo text, p_nome text, p_path text, p_mime text, p_tamanho bigint, p_substituir boolean DEFAULT false)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m public.movimentacoes; codigo text; atual uuid; nome_usuario text;
BEGIN
 IF p_usuario IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_usuario AND role IN ('admin','comum','administradoras','financeiro','executivo_externo')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 SELECT * INTO STRICT m FROM public.movimentacoes WHERE id=p_movimentacao FOR SHARE;
 SELECT codigo_contrato::text INTO codigo FROM public.empresas WHERE id=m.empresa_id;
 IF m.empresa_id<>p_empresa OR codigo IS DISTINCT FROM p_contrato OR m.mes_referencia IS DISTINCT FROM p_competencia OR m.periodo IS DISTINCT FROM p_periodo THEN RAISE EXCEPTION 'Contexto divergente'; END IF;
 IF p_tipo NOT IN ('Relatório de Vidas','OPS Mensalidades') OR p_tamanho<=0 OR p_tamanho>15728640 OR position('_Contrato_'||codigo||'_' IN p_nome)=0 OR position('envios/'||p_movimentacao::text||'/' IN p_path)<>1 THEN RAISE EXCEPTION 'Documento inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|',p_empresa,codigo,p_competencia,coalesce(p_periodo,''),p_tipo),0));
 IF p_substituir THEN
   UPDATE public.envios_empresa_arquivos SET status='Substituído' WHERE empresa_id=p_empresa AND contrato=codigo AND competencia=p_competencia AND periodo IS NOT DISTINCT FROM p_periodo AND tipo_relatorio=p_tipo AND lower(status)='atual';
 ELSE
   SELECT id INTO atual FROM public.envios_empresa_arquivos WHERE empresa_id=p_empresa AND contrato=codigo AND competencia=p_competencia AND periodo IS NOT DISTINCT FROM p_periodo AND tipo_relatorio=p_tipo AND lower(status)='atual' ORDER BY versao DESC LIMIT 1;
   IF atual IS NOT NULL THEN RETURN atual; END IF;
 END IF;
 SELECT coalesce(display_name,username,'Usuário') INTO nome_usuario FROM public.profiles WHERE user_id=p_usuario LIMIT 1;
 INSERT INTO public.envios_empresa_arquivos(envio_id,movimentacao_id,empresa_id,contrato,competencia,periodo,nome_arquivo,bucket,storage_path,mime_type,tamanho_bytes,tipo_relatorio,enviado_por,enviado_nome,origem,versao,status)
 VALUES(gen_random_uuid(),p_movimentacao,p_empresa,codigo,p_competencia,p_periodo,p_nome,'arquivos-envios',p_path,p_mime,p_tamanho,p_tipo,p_usuario,nome_usuario,'Importação para fechamento',coalesce((SELECT max(versao) FROM public.envios_empresa_arquivos WHERE empresa_id=p_empresa AND contrato=codigo AND competencia=p_competencia AND periodo IS NOT DISTINCT FROM p_periodo AND tipo_relatorio=p_tipo),0)+1,'Atual') RETURNING id INTO atual;
 RETURN atual;
END $function$;
REVOKE ALL ON FUNCTION public.registrar_documento_fechamento(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_documento_fechamento(uuid,uuid,uuid,text,text,text,text,text,text,text,bigint,boolean) TO service_role;