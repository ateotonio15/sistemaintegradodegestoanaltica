ALTER TABLE public.palestra_pesquisa_respostas
  ADD COLUMN IF NOT EXISTS teste boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pp_respostas_teste ON public.palestra_pesquisa_respostas (teste);

CREATE OR REPLACE FUNCTION public.responder_pesquisa_por_token(p_token text, p_respostas jsonb, p_empresa text DEFAULT NULL::text, p_teste boolean DEFAULT false)
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

  INSERT INTO public.palestra_pesquisa_respostas (pesquisa_id, empresa_nome, teste)
  VALUES (v_pesquisa, v_empresa, COALESCE(p_teste, false))
  RETURNING id INTO v_resposta;

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

DROP POLICY IF EXISTS "saude editor apaga respostas de teste" ON public.palestra_pesquisa_respostas;
CREATE POLICY "saude editor apaga respostas de teste"
ON public.palestra_pesquisa_respostas
FOR DELETE
TO authenticated
USING (teste = true AND public.is_saude_editor(auth.uid()));

GRANT DELETE ON public.palestra_pesquisa_respostas TO authenticated;