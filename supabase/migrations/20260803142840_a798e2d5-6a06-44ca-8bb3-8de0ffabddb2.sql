-- Templates
CREATE TABLE public.palestra_pesquisa_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.palestra_pesquisa_templates TO authenticated;
GRANT ALL ON public.palestra_pesquisa_templates TO service_role;
ALTER TABLE public.palestra_pesquisa_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saude le templates" ON public.palestra_pesquisa_templates FOR SELECT TO authenticated USING (public.is_saude_reader(auth.uid()));
CREATE POLICY "saude gerencia templates" ON public.palestra_pesquisa_templates FOR ALL TO authenticated USING (public.is_saude_editor(auth.uid())) WITH CHECK (public.is_saude_editor(auth.uid()));

-- Pesquisas por palestra
CREATE TABLE public.palestra_pesquisas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  palestra_id uuid NOT NULL REFERENCES public.palestras_saude(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  aberta boolean NOT NULL DEFAULT true,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (palestra_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.palestra_pesquisas TO authenticated;
GRANT ALL ON public.palestra_pesquisas TO service_role;
ALTER TABLE public.palestra_pesquisas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saude le pesquisas" ON public.palestra_pesquisas FOR SELECT TO authenticated USING (public.is_saude_reader(auth.uid()));
CREATE POLICY "saude gerencia pesquisas" ON public.palestra_pesquisas FOR ALL TO authenticated USING (public.is_saude_editor(auth.uid())) WITH CHECK (public.is_saude_editor(auth.uid()));

-- Perguntas (de template OU de pesquisa)
CREATE TABLE public.palestra_pesquisa_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.palestra_pesquisa_templates(id) ON DELETE CASCADE,
  pesquisa_id uuid REFERENCES public.palestra_pesquisas(id) ON DELETE CASCADE,
  texto text NOT NULL,
  tipo text NOT NULL DEFAULT 'nota',
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  obrigatoria boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pergunta_tipo_valido CHECK (tipo IN ('nota','multipla_escolha','texto_livre')),
  CONSTRAINT pergunta_owner_check CHECK (num_nonnulls(template_id, pesquisa_id) = 1)
);
CREATE INDEX idx_pp_perguntas_template ON public.palestra_pesquisa_perguntas(template_id);
CREATE INDEX idx_pp_perguntas_pesquisa ON public.palestra_pesquisa_perguntas(pesquisa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.palestra_pesquisa_perguntas TO authenticated;
GRANT ALL ON public.palestra_pesquisa_perguntas TO service_role;
ALTER TABLE public.palestra_pesquisa_perguntas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saude le perguntas" ON public.palestra_pesquisa_perguntas FOR SELECT TO authenticated USING (public.is_saude_reader(auth.uid()));
CREATE POLICY "saude gerencia perguntas" ON public.palestra_pesquisa_perguntas FOR ALL TO authenticated USING (public.is_saude_editor(auth.uid())) WITH CHECK (public.is_saude_editor(auth.uid()));

-- Respostas (submissões)
CREATE TABLE public.palestra_pesquisa_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pesquisa_id uuid NOT NULL REFERENCES public.palestra_pesquisas(id) ON DELETE CASCADE,
  respondido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pp_respostas_pesquisa ON public.palestra_pesquisa_respostas(pesquisa_id);
GRANT SELECT ON public.palestra_pesquisa_respostas TO authenticated;
GRANT ALL ON public.palestra_pesquisa_respostas TO service_role;
ALTER TABLE public.palestra_pesquisa_respostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saude le respostas" ON public.palestra_pesquisa_respostas FOR SELECT TO authenticated USING (public.is_saude_reader(auth.uid()));

-- Itens de resposta
CREATE TABLE public.palestra_pesquisa_respostas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.palestra_pesquisa_respostas(id) ON DELETE CASCADE,
  pergunta_id uuid NOT NULL REFERENCES public.palestra_pesquisa_perguntas(id) ON DELETE CASCADE,
  valor_nota integer,
  valor_texto text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pp_itens_resposta ON public.palestra_pesquisa_respostas_itens(resposta_id);
CREATE INDEX idx_pp_itens_pergunta ON public.palestra_pesquisa_respostas_itens(pergunta_id);
GRANT SELECT ON public.palestra_pesquisa_respostas_itens TO authenticated;
GRANT ALL ON public.palestra_pesquisa_respostas_itens TO service_role;
ALTER TABLE public.palestra_pesquisa_respostas_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saude le itens" ON public.palestra_pesquisa_respostas_itens FOR SELECT TO authenticated USING (public.is_saude_reader(auth.uid()));

-- Função pública: obter pesquisa por token
CREATE OR REPLACE FUNCTION public.get_pesquisa_por_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'pesquisa_id', ps.id,
    'aberta', ps.aberta,
    'empresa', pl.empresa,
    'tema', pl.tema,
    'data', pl.data,
    'perguntas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', q.id, 'texto', q.texto, 'tipo', q.tipo,
        'opcoes', q.opcoes, 'obrigatoria', q.obrigatoria, 'ordem', q.ordem
      ) ORDER BY q.ordem, q.created_at)
      FROM public.palestra_pesquisa_perguntas q
      WHERE q.pesquisa_id = ps.id
    ), '[]'::jsonb)
  )
  INTO v
  FROM public.palestra_pesquisas ps
  JOIN public.palestras_saude pl ON pl.id = ps.palestra_id
  WHERE ps.token = p_token;

  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.get_pesquisa_por_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_por_token(text) TO anon, authenticated;

-- Função pública: responder
CREATE OR REPLACE FUNCTION public.responder_pesquisa_por_token(p_token text, p_respostas jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pesquisa uuid;
  v_aberta boolean;
  v_resposta uuid;
  item jsonb;
BEGIN
  SELECT id, aberta INTO v_pesquisa, v_aberta
  FROM public.palestra_pesquisas WHERE token = p_token;

  IF v_pesquisa IS NULL THEN
    RAISE EXCEPTION 'Pesquisa não encontrada';
  END IF;
  IF NOT v_aberta THEN
    RAISE EXCEPTION 'Pesquisa encerrada';
  END IF;

  INSERT INTO public.palestra_pesquisa_respostas (pesquisa_id)
  VALUES (v_pesquisa) RETURNING id INTO v_resposta;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_respostas, '[]'::jsonb))
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.palestra_pesquisa_perguntas q
      WHERE q.id = (item->>'pergunta_id')::uuid AND q.pesquisa_id = v_pesquisa
    ) THEN
      INSERT INTO public.palestra_pesquisa_respostas_itens (resposta_id, pergunta_id, valor_nota, valor_texto)
      VALUES (
        v_resposta,
        (item->>'pergunta_id')::uuid,
        NULLIF(item->>'valor_nota','')::integer,
        NULLIF(item->>'valor_texto','')
      );
    END IF;
  END LOOP;

  RETURN v_resposta;
END;
$$;
REVOKE ALL ON FUNCTION public.responder_pesquisa_por_token(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.responder_pesquisa_por_token(text, jsonb) TO anon, authenticated;

-- Template padrão inicial
INSERT INTO public.palestra_pesquisa_templates (id, nome)
VALUES ('11111111-1111-4111-8111-111111111111', 'Padrão pós-palestra');

INSERT INTO public.palestra_pesquisa_perguntas (template_id, texto, tipo, opcoes, obrigatoria, ordem) VALUES
('11111111-1111-4111-8111-111111111111', 'Como você avalia a palestra de forma geral?', 'nota', '[]'::jsonb, true, 1),
('11111111-1111-4111-8111-111111111111', 'O tema abordado foi relevante para você?', 'nota', '[]'::jsonb, true, 2),
('11111111-1111-4111-8111-111111111111', 'Como você avalia o palestrante?', 'nota', '[]'::jsonb, true, 3),
('11111111-1111-4111-8111-111111111111', 'Qual tema você gostaria na próxima palestra?', 'multipla_escolha', '["Saúde Mental","Nutrição","Ergonomia","Atividade Física","Prevenção de Doenças"]'::jsonb, false, 4),
('11111111-1111-4111-8111-111111111111', 'Deixe um comentário ou sugestão', 'texto_livre', '[]'::jsonb, false, 5);