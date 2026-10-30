-- Só quem lê a movimentação de destino consegue baixar o arquivo do repositório.
-- O caminho é envios/<movimentacao_id>/<envio_id>/<contrato>-<tipo>-<nome>.
CREATE POLICY envios_empresa_download ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'arquivos-envios'
    AND (storage.foldername(name))[1] = 'envios'
    AND EXISTS (
      SELECT 1 FROM public.movimentacoes m
      WHERE m.id::text = (storage.foldername(name))[2]
    )
  );