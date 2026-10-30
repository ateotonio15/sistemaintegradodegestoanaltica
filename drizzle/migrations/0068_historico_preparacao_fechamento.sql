ALTER TABLE public.anexos_movimentacao ADD COLUMN origem_importacao text;
CREATE TABLE public.movimentacao_fechamento_historico (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), movimentacao_id uuid NOT NULL,
 evento text NOT NULL, anexo_id uuid, nome_arquivo text, tipo_relatorio text,
 contrato text NOT NULL DEFAULT '', competencia text NOT NULL DEFAULT '', periodo text,
 origem text NOT NULL DEFAULT 'API / integração', criado_em timestamptz NOT NULL DEFAULT now(),
 usuario_id uuid NOT NULL DEFAULT auth.uid(), usuario_nome text NOT NULL DEFAULT '',
 pendencias text[] NOT NULL DEFAULT '{}', UNIQUE(anexo_id)
);
GRANT SELECT, INSERT ON public.movimentacao_fechamento_historico TO authenticated;
GRANT ALL ON public.movimentacao_fechamento_historico TO service_role;
ALTER TABLE public.movimentacao_fechamento_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY fechamento_historico_ler ON public.movimentacao_fechamento_historico FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.movimentacoes m WHERE m.id=movimentacao_id));
CREATE POLICY fechamento_historico_continuar ON public.movimentacao_fechamento_historico FOR INSERT TO authenticated WITH CHECK (evento='continuacao_pendente' AND usuario_id=auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum') OR public.has_role(auth.uid(),'administradoras') OR public.has_role(auth.uid(),'financeiro')) AND EXISTS(SELECT 1 FROM public.movimentacoes m WHERE m.id=movimentacao_id));
CREATE FUNCTION public.validar_historico_fechamento() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE m public.movimentacoes; codigo text;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Histórico de fechamento não pode ser alterado ou excluído.'; END IF;
 SELECT * INTO STRICT m FROM public.movimentacoes WHERE id=NEW.movimentacao_id;
 SELECT codigo_contrato::text INTO codigo FROM public.empresas WHERE id=m.empresa_id;
 NEW.contrato=coalesce(codigo,''); NEW.competencia=m.mes_referencia; NEW.periodo=m.periodo;
 NEW.usuario_id=auth.uid(); IF NEW.usuario_id IS NULL THEN RAISE EXCEPTION 'Usuário obrigatório'; END IF;
 SELECT coalesce(display_name,username,'Usuário') INTO NEW.usuario_nome FROM public.profiles WHERE user_id=NEW.usuario_id LIMIT 1;
 NEW.usuario_nome=coalesce(NEW.usuario_nome,'Usuário'); NEW.criado_em=now(); NEW.origem='API / integração';
 IF NEW.evento='continuacao_pendente' THEN
  IF cardinality(NEW.pendencias)=0 OR NOT NEW.pendencias <@ ARRAY['Relatório de Vidas - PDF','OPS Mensalidades - Excel']::text[] THEN RAISE EXCEPTION 'Pendências inválidas'; END IF;
  NEW.anexo_id=NULL; NEW.nome_arquivo=NULL; NEW.tipo_relatorio=NULL;
 ELSIF NEW.evento<>'arquivo_importado' THEN RAISE EXCEPTION 'Evento inválido'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fechamento_historico_validar BEFORE INSERT OR UPDATE OR DELETE ON public.movimentacao_fechamento_historico FOR EACH ROW EXECUTE FUNCTION public.validar_historico_fechamento();
CREATE FUNCTION public.auditar_anexo_importado() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE codigo text;
BEGIN
 IF NEW.origem_importacao IS DISTINCT FROM 'API' THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum') OR public.has_role(auth.uid(),'administradoras') OR public.has_role(auth.uid(),'financeiro')) THEN RAISE EXCEPTION 'Importação não autorizada'; END IF;
 SELECT e.codigo_contrato::text INTO codigo FROM public.empresas e JOIN public.movimentacoes m ON m.empresa_id=e.id WHERE m.id=NEW.movimentacao_id AND m.empresa_id=NEW.empresa_id;
 IF codigo IS NULL OR position('_Contrato_'||codigo||'_' in NEW.nome_arquivo)=0 THEN RAISE EXCEPTION 'Contrato do arquivo divergente'; END IF;
 INSERT INTO public.movimentacao_fechamento_historico(movimentacao_id,evento,anexo_id,nome_arquivo,tipo_relatorio)
 VALUES(NEW.movimentacao_id,'arquivo_importado',NEW.id,NEW.nome_arquivo,CASE WHEN NEW.nome_arquivo ~* '\.pdf$' THEN 'Relatório de Vidas - PDF' ELSE 'OPS Mensalidades - Excel' END);
 RETURN NEW;
END $$;
CREATE TRIGGER anexo_importado_historico AFTER INSERT ON public.anexos_movimentacao FOR EACH ROW EXECUTE FUNCTION public.auditar_anexo_importado();
REVOKE ALL ON FUNCTION public.auditar_anexo_importado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_historico_fechamento() FROM PUBLIC, anon, authenticated;