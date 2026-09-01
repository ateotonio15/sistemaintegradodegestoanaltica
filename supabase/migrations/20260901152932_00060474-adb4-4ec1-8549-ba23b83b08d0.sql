ALTER TABLE public.palestra_pesquisas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'palestra';

ALTER TABLE public.palestra_pesquisas
  DROP CONSTRAINT IF EXISTS palestra_pesquisas_tipo_check;
ALTER TABLE public.palestra_pesquisas
  ADD CONSTRAINT palestra_pesquisas_tipo_check CHECK (tipo IN ('palestra','acao'));

DROP INDEX IF EXISTS public.palestra_pesquisas_geral_unica;
CREATE UNIQUE INDEX palestra_pesquisas_geral_unica
  ON public.palestra_pesquisas (tipo) WHERE geral;

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
    'geral', ps.geral,
    'tipo', ps.tipo,
    'exige_empresa', ps.geral,
    'empresa', COALESCE(pl.empresa, ps.titulo, 'Pesquisa de Satisfação'),
    'tema', COALESCE(pl.tema, CASE WHEN ps.tipo = 'acao' THEN 'Ações de saúde' ELSE NULL END),
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
$$;