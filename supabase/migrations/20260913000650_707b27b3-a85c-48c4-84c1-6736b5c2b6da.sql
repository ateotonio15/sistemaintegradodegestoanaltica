-- 1. Histórico imutável
CREATE OR REPLACE FUNCTION public.contrato_processo_hist_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Registros do histórico do processo não podem ser alterados ou excluídos. Registre uma correção como novo evento.';
END;
$$;

DROP TRIGGER IF EXISTS trg_hist_no_update ON public.contrato_processo_movimentacoes;
CREATE TRIGGER trg_hist_no_update BEFORE UPDATE ON public.contrato_processo_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_hist_imutavel();

DROP TRIGGER IF EXISTS trg_hist_no_delete ON public.contrato_processo_movimentacoes;
CREATE TRIGGER trg_hist_no_delete BEFORE DELETE ON public.contrato_processo_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_hist_imutavel();

-- 2. Helper de log automático
CREATE OR REPLACE FUNCTION public._log_processo_evento(
  p_processo_id uuid,
  p_acao text,
  p_observacao text DEFAULT NULL,
  p_detalhes jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proc public.contrato_processos;
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  IF p_processo_id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_proc FROM public.contrato_processos WHERE id = p_processo_id;
  IF v_proc.id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(display_name, username) INTO v_nome FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.contrato_processo_movimentacoes (
    processo_id, acao, setor_origem, status_detalhado_anterior, observacao, detalhes, user_id, user_nome, responsavel_nome
  ) VALUES (
    p_processo_id, p_acao, v_proc.setor_atual, v_proc.status,
    NULLIF(p_observacao, ''), COALESCE(p_detalhes, '{}'::jsonb), v_uid, v_nome, v_proc.responsavel_atual_nome
  );
END;
$$;

REVOKE ALL ON FUNCTION public._log_processo_evento(uuid, text, text, jsonb) FROM anon, authenticated;

-- 3. Eventos de pendência
CREATE OR REPLACE FUNCTION public.contrato_processo_pendencia_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._log_processo_evento(
      NEW.processo_id, 'pendencia_aberta',
      NEW.titulo || ' — ' || COALESCE(NEW.categoria,'Outros') || ' (' || COALESCE(NEW.criticidade,'Média') || '), setor ' || COALESCE(NEW.setor::text,'—'),
      jsonb_build_object('pendencia_id', NEW.id, 'categoria', NEW.categoria, 'criticidade', NEW.criticidade)
    );
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') <> COALESCE(NEW.status,'') THEN
    PERFORM public._log_processo_evento(
      NEW.processo_id,
      CASE WHEN NEW.status = 'Resolvida' THEN 'pendencia_resolvida'
           WHEN NEW.status = 'Cancelada' THEN 'pendencia_cancelada'
           ELSE 'pendencia_atualizada' END,
      NEW.titulo || ': ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—')
        || COALESCE(' · ' || NULLIF(NEW.observacao_resolucao,''), ''),
      jsonb_build_object('pendencia_id', NEW.id, 'status_anterior', OLD.status, 'status_novo', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pendencia_log ON public.contrato_processo_pendencias;
CREATE TRIGGER trg_pendencia_log AFTER INSERT OR UPDATE ON public.contrato_processo_pendencias
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_pendencia_log();

-- 4. Documentos anexados na implantação
CREATE OR REPLACE FUNCTION public.implantacao_anexo_log_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_proc uuid;
BEGIN
  SELECT id INTO v_proc FROM public.contrato_processos WHERE implantacao_id = NEW.implantacao_id LIMIT 1;
  IF v_proc IS NULL THEN RETURN NEW; END IF;
  PERFORM public._log_processo_evento(
    v_proc, 'documento_anexado',
    COALESCE(NEW.nome_arquivo, 'Documento') || COALESCE(' · ' || NULLIF(NEW.tipo,''), ''),
    jsonb_build_object('anexo_id', NEW.id, 'tipo', NEW.tipo)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impl_anexo_log ON public.implantacao_anexos;
CREATE TRIGGER trg_impl_anexo_log AFTER INSERT ON public.implantacao_anexos
FOR EACH ROW EXECUTE FUNCTION public.implantacao_anexo_log_processo();

-- 5. Extrações / análise IA / responsável
CREATE OR REPLACE FUNCTION public.implantacao_log_analises()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_proc uuid;
BEGIN
  SELECT id INTO v_proc FROM public.contrato_processos WHERE implantacao_id = NEW.id LIMIT 1;
  IF v_proc IS NULL THEN RETURN NEW; END IF;

  IF NEW.extracao_anexo1_em IS DISTINCT FROM OLD.extracao_anexo1_em AND NEW.extracao_anexo1_em IS NOT NULL THEN
    PERFORM public._log_processo_evento(v_proc, 'extracao_concluida', 'Extração do Anexo I por arquivo concluída.');
  END IF;

  IF NEW.extracao_anexo1_texto_em IS DISTINCT FROM OLD.extracao_anexo1_texto_em AND NEW.extracao_anexo1_texto_em IS NOT NULL THEN
    PERFORM public._log_processo_evento(v_proc, 'extracao_concluida', 'Extração do Anexo I por texto concluída.');
  END IF;

  IF NEW.analise_contrato_em IS DISTINCT FROM OLD.analise_contrato_em AND NEW.analise_contrato_em IS NOT NULL THEN
    PERFORM public._log_processo_evento(v_proc, 'analise_ia_concluida', 'Análise automática do contrato concluída e vinculada ao processo.');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impl_log_analises ON public.implantacoes_contratos;
CREATE TRIGGER trg_impl_log_analises AFTER UPDATE ON public.implantacoes_contratos
FOR EACH ROW EXECUTE FUNCTION public.implantacao_log_analises();

-- 6. Responsável / resultado final alterados no processo
CREATE OR REPLACE FUNCTION public.contrato_processo_log_mudancas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(OLD.responsavel_atual_id::text,'') IS DISTINCT FROM COALESCE(NEW.responsavel_atual_id::text,'')
     OR COALESCE(OLD.responsavel_atual_nome,'') IS DISTINCT FROM COALESCE(NEW.responsavel_atual_nome,'') THEN
    PERFORM public._log_processo_evento(
      NEW.id, 'responsavel_alterado',
      COALESCE(OLD.responsavel_atual_nome,'sem responsável') || ' → ' || COALESCE(NEW.responsavel_atual_nome,'sem responsável')
    );
  END IF;

  IF COALESCE(OLD.resultado_final,'') IS DISTINCT FROM COALESCE(NEW.resultado_final,'') THEN
    PERFORM public._log_processo_evento(
      NEW.id,
      CASE NEW.resultado_final
        WHEN 'Aprovado' THEN 'aprovado'
        WHEN 'Aprovado com ressalva' THEN 'aprovado_ressalva'
        WHEN 'Reprovado' THEN 'reprovado'
        WHEN 'Implantado' THEN 'implantado'
        ELSE 'resultado_alterado' END,
      'Resultado final: ' || COALESCE(OLD.resultado_final,'—') || ' → ' || COALESCE(NEW.resultado_final,'—')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_processo_log_mudancas ON public.contrato_processos;
CREATE TRIGGER trg_processo_log_mudancas AFTER UPDATE ON public.contrato_processos
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_log_mudancas();