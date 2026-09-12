-- Mapeia etapa da implantação -> (setor, status, próxima ação)
CREATE OR REPLACE FUNCTION public.map_implantacao_processo(p_status text)
RETURNS TABLE (setor text, status text, proxima_acao text)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT t.s, t.st, t.pa FROM (VALUES
    ('em_analise', 'analise_automatica', 'analise_automatica', 'Concluir análise automática dos documentos'),
    ('aguardando_documentos', 'documentos', 'aguardando_documento_empresa', 'Receber documentos da empresa'),
    ('documentacao_pendente', 'documentos', 'aguardando_documento_empresa', 'Cobrar documentos pendentes'),
    ('em_validacao', 'juridico', 'analise_juridica', 'Emitir parecer jurídico'),
    ('em_analise_diretoria', 'diretoria', 'em_revisao', 'Aprovação da diretoria'),
    ('aprovado_diretoria', 'diretoria', 'aprovado', 'Enviar para o cadastro'),
    ('enviado_cadastro', 'cadastro', 'aguardando_cadastro', 'Iniciar cadastro do contrato'),
    ('em_implantacao', 'cadastro', 'analise_cadastro', 'Concluir implantação do contrato'),
    ('pendente_ajuste', 'cadastro', 'pendencia_cadastral', 'Ajustar pendências do cadastro'),
    ('necessita_correcao', 'cadastro', 'pendencia_cadastral', 'Corrigir informações apontadas'),
    ('rejeitado', 'concluido', 'reprovado', NULL),
    ('implantado', 'concluido', 'implantado', NULL)
  ) AS t(k, s, st, pa) WHERE t.k = p_status;
$$;

-- Cria processo automaticamente e sincroniza status/setor conforme a etapa da implantação
CREATE OR REPLACE FUNCTION public.sync_processo_implantacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc public.contrato_processos;
  v_map record;
  v_nome text;
  v_uid uuid;
BEGIN
  v_uid := COALESCE(auth.uid(), NEW.created_by);
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  v_nome := COALESCE(v_nome, NEW.created_by_nome);

  SELECT * INTO v_map FROM public.map_implantacao_processo(NEW.status::text);

  SELECT * INTO v_proc FROM public.contrato_processos WHERE implantacao_id = NEW.id LIMIT 1;

  IF v_proc.id IS NULL THEN
    INSERT INTO public.contrato_processos (
      implantacao_id, empresa_id, nome_empresa, cnpj,
      status, setor_atual, proxima_acao,
      responsavel_atual_id, responsavel_atual_nome, created_by, created_by_nome
    ) VALUES (
      NEW.id, NEW.empresa_id, NEW.nome_empresa, NEW.cnpj,
      COALESCE(v_map.status, 'recebido'), COALESCE(v_map.setor, 'documentos'), v_map.proxima_acao,
      COALESCE(NEW.responsavel_cadastro_user_id, v_uid),
      COALESCE(NEW.responsavel_cadastro_nome, v_nome), v_uid, v_nome
    ) RETURNING * INTO v_proc;

    INSERT INTO public.contrato_processo_movimentacoes (
      processo_id, acao, setor_destino, status_novo, status_detalhado_novo, resultado_novo,
      responsavel_id, responsavel_nome, observacao, user_id, user_nome
    ) VALUES (
      v_proc.id, 'processo_criado', COALESCE(v_map.setor, 'documentos'), 'aberto',
      COALESCE(v_map.status, 'recebido'), 'Em análise',
      v_proc.responsavel_atual_id, v_proc.responsavel_atual_nome,
      'Processo criado automaticamente pela implantação', v_uid, v_nome
    );
    RETURN NEW;
  END IF;

  -- Atualização: só age quando a etapa muda e há mapeamento
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) AND v_map.setor IS NOT NULL THEN
    IF v_proc.setor_atual::text IS DISTINCT FROM v_map.setor
       OR v_proc.status::text IS DISTINCT FROM v_map.status THEN
      INSERT INTO public.contrato_processo_movimentacoes (
        processo_id, acao, setor_origem, setor_destino,
        status_detalhado_anterior, status_detalhado_novo,
        resultado_anterior, resultado_novo,
        responsavel_id, responsavel_nome, observacao, user_id, user_nome
      ) VALUES (
        v_proc.id, 'encaminhado', v_proc.setor_atual::text, v_map.setor,
        v_proc.status::text, v_map.status,
        v_proc.resultado_final,
        CASE v_map.status
          WHEN 'implantado' THEN 'Implantado'
          WHEN 'reprovado' THEN 'Reprovado'
          WHEN 'aprovado' THEN 'Aprovado'
          ELSE v_proc.resultado_final
        END,
        COALESCE(NEW.responsavel_cadastro_user_id, v_uid),
        COALESCE(NEW.responsavel_cadastro_nome, v_nome),
        'Movimentação automática: etapa da implantação alterada para ' || NEW.status::text,
        v_uid, v_nome
      );

      UPDATE public.contrato_processos
         SET proxima_acao = v_map.proxima_acao,
             status_geral = CASE WHEN v_map.setor = 'concluido' THEN 'concluido' ELSE 'em_andamento' END
       WHERE id = v_proc.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_processo_implantacao ON public.implantacoes_contratos;
CREATE TRIGGER trg_sync_processo_implantacao
AFTER INSERT OR UPDATE OF status ON public.implantacoes_contratos
FOR EACH ROW EXECUTE FUNCTION public.sync_processo_implantacao();

-- Backfill: cria processo para implantações existentes sem processo
INSERT INTO public.contrato_processos (
  implantacao_id, empresa_id, nome_empresa, cnpj, status, setor_atual, proxima_acao,
  responsavel_atual_id, responsavel_atual_nome, created_by, created_by_nome,
  status_geral, resultado_final
)
SELECT i.id, i.empresa_id, i.nome_empresa, i.cnpj,
       COALESCE(m.status, 'recebido'), COALESCE(m.setor, 'documentos'), m.proxima_acao,
       i.responsavel_cadastro_user_id, i.responsavel_cadastro_nome, i.created_by, i.created_by_nome,
       CASE WHEN COALESCE(m.setor,'documentos') = 'concluido' THEN 'concluido' ELSE 'em_andamento' END,
       CASE COALESCE(m.status,'recebido') WHEN 'implantado' THEN 'Implantado' WHEN 'reprovado' THEN 'Reprovado' ELSE 'Em análise' END
  FROM public.implantacoes_contratos i
  LEFT JOIN LATERAL public.map_implantacao_processo(i.status::text) m ON true
 WHERE NOT EXISTS (SELECT 1 FROM public.contrato_processos p WHERE p.implantacao_id = i.id);
