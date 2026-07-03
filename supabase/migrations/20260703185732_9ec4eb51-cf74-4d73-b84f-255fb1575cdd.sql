
-- 1) empresa_prioridade_maxima: restringir SELECT a papéis internos
DROP POLICY IF EXISTS "Todos autenticados podem ver prioridade" ON public.empresa_prioridade_maxima;

CREATE POLICY "Papéis internos podem ver prioridade"
ON public.empresa_prioridade_maxima
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR has_role(auth.uid(), 'comum'::app_role)
  OR has_role(auth.uid(), 'executivo'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'administradoras'::app_role)
  OR has_role(auth.uid(), 'visualizacao'::app_role)
);

-- 2) cs_avaliacao_formularios: remover acesso anônimo direto
DROP POLICY IF EXISTS cs_avaliacao_formularios_public_read ON public.cs_avaliacao_formularios;

-- Função pública com escopo por token, retornando somente o formulário do envio
CREATE OR REPLACE FUNCTION public.get_avaliacao_formulario_por_token(p_token text)
RETURNS TABLE (
  id uuid,
  titulo text,
  tipo text,
  instrucoes text,
  perguntas jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH env AS (
    SELECT e.formulario_id, e.data_resposta
    FROM public.avaliacoes_envios e
    WHERE e.token_unico = p_token
    LIMIT 1
  ),
  fid AS (
    SELECT
      COALESCE(
        (SELECT formulario_id FROM env WHERE data_resposta IS NULL),
        (SELECT id FROM public.cs_avaliacao_formularios
          WHERE tipo = 'rh' ORDER BY created_at DESC LIMIT 1)
      ) AS id
    WHERE EXISTS (SELECT 1 FROM env WHERE data_resposta IS NULL)
  )
  SELECT f.id, f.titulo, f.tipo, f.instrucoes, f.perguntas
  FROM public.cs_avaliacao_formularios f
  JOIN fid ON fid.id = f.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_avaliacao_formulario_por_token(text) TO anon, authenticated;

-- 3) Storage anexos-movimentacoes: exigir vínculo com anexos_movimentacao
DROP POLICY IF EXISTS "Delete own anexos-movimentacoes storage" ON storage.objects;
DROP POLICY IF EXISTS "Update own anexos-movimentacoes storage" ON storage.objects;

CREATE POLICY "Delete anexos-movimentacoes com vínculo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'anexos-movimentacoes'
  AND EXISTS (
    SELECT 1
    FROM public.anexos_movimentacao a
    WHERE a.storage_path = storage.objects.name
      AND (
        a.uploaded_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'financeiro'::app_role)
      )
  )
);

CREATE POLICY "Update anexos-movimentacoes com vínculo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'anexos-movimentacoes'
  AND EXISTS (
    SELECT 1
    FROM public.anexos_movimentacao a
    WHERE a.storage_path = storage.objects.name
      AND (
        a.uploaded_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'financeiro'::app_role)
      )
  )
)
WITH CHECK (
  bucket_id = 'anexos-movimentacoes'
  AND EXISTS (
    SELECT 1
    FROM public.anexos_movimentacao a
    WHERE a.storage_path = storage.objects.name
      AND (
        a.uploaded_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'financeiro'::app_role)
      )
  )
);
