
-- Painel TV meta diaria: restringir writes
DROP POLICY IF EXISTS "auth write meta diaria" ON public.painel_tv_meta_diaria;
CREATE POLICY "admin diretora write meta diaria"
  ON public.painel_tv_meta_diaria
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretora'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretora'::app_role));

-- CS avaliacao respostas: exigir compartilhamento_id e limitar payload
DROP POLICY IF EXISTS "cs_avaliacao_respostas_public_insert" ON public.cs_avaliacao_respostas;
CREATE POLICY "cs_avaliacao_respostas_public_insert"
  ON public.cs_avaliacao_respostas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    compartilhamento_id IS NOT NULL
    AND octet_length(respostas::text) <= 16384
    AND (respondente IS NULL OR length(respondente) <= 200)
    AND (comentario IS NULL OR length(comentario) <= 4000)
    AND (nome_empresa IS NULL OR length(nome_empresa) <= 200)
    AND (nome_executiva IS NULL OR length(nome_executiva) <= 200)
  );
