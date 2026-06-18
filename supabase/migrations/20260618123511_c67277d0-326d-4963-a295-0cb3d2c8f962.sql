DROP POLICY IF EXISTS cs_avaliacao_respostas_public_insert ON public.cs_avaliacao_respostas;

CREATE POLICY cs_avaliacao_respostas_public_insert
ON public.cs_avaliacao_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  compartilhamento_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.cs_avaliacao_formularios f WHERE f.id = formulario_id)
  AND octet_length((respostas)::text) <= 16384
  AND (respondente IS NULL OR length(respondente) <= 200)
  AND (comentario IS NULL OR length(comentario) <= 4000)
  AND (nome_empresa IS NULL OR length(nome_empresa) <= 200)
  AND (nome_executiva IS NULL OR length(nome_executiva) <= 200)
);