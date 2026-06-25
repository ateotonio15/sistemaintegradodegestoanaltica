
DROP POLICY IF EXISTS cs_avaliacao_respostas_public_insert ON public.cs_avaliacao_respostas;

CREATE POLICY cs_avaliacao_respostas_public_insert
ON public.cs_avaliacao_respostas
FOR INSERT
TO anon, authenticated
WITH CHECK (
  compartilhamento_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.avaliacoes_envios e
    WHERE e.id = compartilhamento_id
      AND e.formulario_id = cs_avaliacao_respostas.formulario_id
      AND e.data_resposta IS NULL
  )
);
