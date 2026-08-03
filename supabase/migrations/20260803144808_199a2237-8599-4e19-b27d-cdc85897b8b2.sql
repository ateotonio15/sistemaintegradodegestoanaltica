ALTER TABLE public.palestra_pesquisas ALTER COLUMN palestra_id DROP NOT NULL;
ALTER TABLE public.palestra_pesquisas ADD COLUMN IF NOT EXISTS geral boolean NOT NULL DEFAULT false;
ALTER TABLE public.palestra_pesquisas ADD COLUMN IF NOT EXISTS titulo text;
CREATE UNIQUE INDEX IF NOT EXISTS palestra_pesquisas_geral_unica ON public.palestra_pesquisas (geral) WHERE geral;

ALTER TABLE public.palestra_pesquisa_respostas ADD COLUMN IF NOT EXISTS empresa_nome text;

CREATE OR REPLACE FUNCTION public.get_pesquisa_por_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'pesquisa_id', ps.id,
    'aberta', ps.aberta,
    'geral', ps.geral,
    'exige_empresa', ps.geral,
    'empresa', COALESCE(pl.empresa, ps.titulo, 'Pesquisa de Satisfação'),
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
  LEFT JOIN public.palestras_saude pl ON pl.id = ps.palestra_id
  WHERE ps.token = p_token;

  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.responder_pesquisa_por_token(p_token text, p_respostas jsonb, p_empresa text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pesquisa uuid;
  v_aberta boolean;
  v_geral boolean;
  v_resposta uuid;
  v_empresa text;
  item jsonb;
BEGIN
  SELECT id, aberta, geral INTO v_pesquisa, v_aberta, v_geral
  FROM public.palestra_pesquisas WHERE token = p_token;

  IF v_pesquisa IS NULL THEN
    RAISE EXCEPTION 'Pesquisa não encontrada';
  END IF;
  IF NOT v_aberta THEN
    RAISE EXCEPTION 'Pesquisa encerrada';
  END IF;

  v_empresa := NULLIF(btrim(COALESCE(p_empresa, '')), '');
  IF v_geral AND v_empresa IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da empresa';
  END IF;
  v_empresa := left(v_empresa, 150);

  INSERT INTO public.palestra_pesquisa_respostas (pesquisa_id, empresa_nome)
  VALUES (v_pesquisa, v_empresa) RETURNING id INTO v_resposta;

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
$function$;