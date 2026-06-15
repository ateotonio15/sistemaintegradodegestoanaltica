ALTER TABLE public.cs_avaliacao_respostas
  ADD COLUMN IF NOT EXISTS nota_media numeric(3,2),
  ADD COLUMN IF NOT EXISTS comentario text,
  ADD COLUMN IF NOT EXISTS nome_empresa text,
  ADD COLUMN IF NOT EXISTS nome_executiva text,
  ADD COLUMN IF NOT EXISTS compartilhamento_id uuid;

GRANT INSERT ON public.cs_avaliacao_respostas TO anon;

DROP POLICY IF EXISTS "cs_avaliacao_respostas_public_insert" ON public.cs_avaliacao_respostas;
CREATE POLICY "cs_avaliacao_respostas_public_insert"
  ON public.cs_avaliacao_respostas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

GRANT SELECT ON public.cs_avaliacao_formularios TO anon;
DROP POLICY IF EXISTS "cs_avaliacao_formularios_public_read" ON public.cs_avaliacao_formularios;
CREATE POLICY "cs_avaliacao_formularios_public_read"
  ON public.cs_avaliacao_formularios
  FOR SELECT
  TO anon, authenticated
  USING (true);