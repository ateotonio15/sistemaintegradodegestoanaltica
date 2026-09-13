ALTER TABLE public.implantacoes_contratos
  ADD COLUMN IF NOT EXISTS analise_contrato jsonb,
  ADD COLUMN IF NOT EXISTS analise_contrato_em timestamptz,
  ADD COLUMN IF NOT EXISTS extracao_anexo1 jsonb,
  ADD COLUMN IF NOT EXISTS extracao_anexo1_em timestamptz,
  ADD COLUMN IF NOT EXISTS extracao_anexo1_texto jsonb,
  ADD COLUMN IF NOT EXISTS extracao_anexo1_texto_em timestamptz,
  ADD COLUMN IF NOT EXISTS validacao_cruzada_em timestamptz;

CREATE TABLE IF NOT EXISTS public.contrato_validacoes_cruzadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.contrato_processos(id) ON DELETE CASCADE,
  implantacao_id uuid,
  campo text NOT NULL,
  rotulo text,
  valor_contrato text,
  valor_anexo text,
  resultado text NOT NULL DEFAULT 'necessita_validacao',
  criticidade text NOT NULL DEFAULT 'Média',
  setor_destino text,
  justificativa text,
  pendencia_id uuid,
  executado_por uuid,
  executado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT validacao_resultado_chk CHECK (resultado IN ('compativel','divergente','nao_encontrado','necessita_validacao')),
  CONSTRAINT validacao_criticidade_chk CHECK (criticidade IN ('Baixa','Média','Alta','Crítica')),
  CONSTRAINT validacao_campo_uk UNIQUE (processo_id, campo)
);

GRANT SELECT ON public.contrato_validacoes_cruzadas TO authenticated;
GRANT ALL ON public.contrato_validacoes_cruzadas TO service_role;

ALTER TABLE public.contrato_validacoes_cruzadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "validacao_cruzada_select" ON public.contrato_validacoes_cruzadas
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_validacao_cruzada_touch
  BEFORE UPDATE ON public.contrato_validacoes_cruzadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.executar_validacao_cruzada(
  p_processo_id uuid,
  p_itens jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc public.contrato_processos;
  v_item jsonb;
  v_uid uuid := auth.uid();
  v_nome text;
  v_pend_id uuid;
  v_criticas int := 0;
  v_diverg int := 0;
  v_criadas int := 0;
  v_setor text;
BEGIN
  SELECT * INTO v_proc FROM public.contrato_processos WHERE id = p_processo_id;
  IF v_proc.id IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;

  SELECT COALESCE(display_name, username) INTO v_nome FROM public.profiles WHERE id = v_uid;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) LOOP
    v_setor := NULLIF(v_item->>'setor_destino','');
    v_pend_id := NULL;

    IF (v_item->>'resultado') = 'divergente' THEN
      v_diverg := v_diverg + 1;
      IF (v_item->>'criticidade') = 'Crítica' THEN
        v_criticas := v_criticas + 1;
      END IF;

      -- pendência automática (não duplica pendência em aberto do mesmo campo)
      SELECT p.id INTO v_pend_id
      FROM public.contrato_processo_pendencias p
      WHERE p.processo_id = p_processo_id
        AND p.titulo = COALESCE(v_item->>'titulo_pendencia', 'Divergência: ' || COALESCE(v_item->>'rotulo', v_item->>'campo'))
        AND p.status NOT IN ('Resolvida','Cancelada')
      LIMIT 1;

      IF v_pend_id IS NULL THEN
        INSERT INTO public.contrato_processo_pendencias (
          processo_id, setor, titulo, descricao, categoria, criticidade, status, created_by, created_by_nome
        ) VALUES (
          p_processo_id,
          COALESCE(v_setor, 'cadastro')::text,
          COALESCE(v_item->>'titulo_pendencia', 'Divergência: ' || COALESCE(v_item->>'rotulo', v_item->>'campo')),
          COALESCE(v_item->>'justificativa', 'Divergência identificada na validação cruzada.'),
          COALESCE(NULLIF(v_item->>'categoria',''), 'Divergência de dados'),
          COALESCE(NULLIF(v_item->>'criticidade',''), 'Média'),
          'Aberta',
          v_uid,
          v_nome
        ) RETURNING id INTO v_pend_id;
        v_criadas := v_criadas + 1;
      END IF;
    END IF;

    INSERT INTO public.contrato_validacoes_cruzadas (
      processo_id, implantacao_id, campo, rotulo, valor_contrato, valor_anexo,
      resultado, criticidade, setor_destino, justificativa, pendencia_id,
      executado_por, executado_por_nome
    ) VALUES (
      p_processo_id, v_proc.implantacao_id, v_item->>'campo', v_item->>'rotulo',
      NULLIF(v_item->>'valor_contrato',''), NULLIF(v_item->>'valor_anexo',''),
      COALESCE(NULLIF(v_item->>'resultado',''),'necessita_validacao'),
      COALESCE(NULLIF(v_item->>'criticidade',''),'Média'),
      v_setor, NULLIF(v_item->>'justificativa',''), v_pend_id,
      v_uid, v_nome
    )
    ON CONFLICT (processo_id, campo) DO UPDATE SET
      valor_contrato = EXCLUDED.valor_contrato,
      valor_anexo = EXCLUDED.valor_anexo,
      resultado = EXCLUDED.resultado,
      criticidade = EXCLUDED.criticidade,
      setor_destino = EXCLUDED.setor_destino,
      justificativa = EXCLUDED.justificativa,
      rotulo = EXCLUDED.rotulo,
      pendencia_id = COALESCE(EXCLUDED.pendencia_id, public.contrato_validacoes_cruzadas.pendencia_id),
      executado_por = EXCLUDED.executado_por,
      executado_por_nome = EXCLUDED.executado_por_nome,
      updated_at = now();
  END LOOP;

  INSERT INTO public.contrato_processo_movimentacoes (
    processo_id, acao, setor_origem, setor_destino, observacao, detalhes, user_id, user_nome
  ) VALUES (
    p_processo_id, 'validacao_cruzada', v_proc.setor_atual::text, v_proc.setor_atual::text,
    'Validação cruzada executada: ' || v_diverg || ' divergência(s), ' || v_criticas || ' crítica(s), ' || v_criadas || ' pendência(s) criada(s).',
    jsonb_build_object('divergencias', v_diverg, 'criticas', v_criticas, 'pendencias_criadas', v_criadas),
    v_uid, v_nome
  );

  IF v_proc.implantacao_id IS NOT NULL THEN
    UPDATE public.implantacoes_contratos
      SET validacao_cruzada_em = now(), updated_at = now()
    WHERE id = v_proc.implantacao_id;
  END IF;

  RETURN jsonb_build_object('divergencias', v_diverg, 'criticas', v_criticas, 'pendencias_criadas', v_criadas);
END;
$$;

REVOKE ALL ON FUNCTION public.executar_validacao_cruzada(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.executar_validacao_cruzada(uuid, jsonb) TO authenticated;