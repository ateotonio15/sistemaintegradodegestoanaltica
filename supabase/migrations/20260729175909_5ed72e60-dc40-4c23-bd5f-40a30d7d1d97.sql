INSERT INTO public.financeiro_arquivos (
  empresa_id, competencia, categoria, nome_original, nome_armazenado, extensao,
  mime_type, tamanho_bytes, observacao, uploaded_by, storage_path, status, versao,
  bucket, origem, anexo_financeiro_id, financeiro_movimentacao_id
)
SELECT m.empresa_id,
       m.mes_referencia,
       'Reajuste',
       a.nome_arquivo,
       a.nome_arquivo,
       lower(split_part(a.nome_arquivo, '.', array_length(string_to_array(a.nome_arquivo, '.'), 1))),
       a.mime_type,
       a.tamanho_bytes,
       'Migrado da aba Reajuste (Financeiro)',
       a.uploaded_by,
       a.storage_path,
       'ativo',
       1,
       'anexos-financeiro',
       'reajuste',
       a.id,
       a.financeiro_movimentacao_id
FROM public.anexos_financeiro a
JOIN public.financeiro_movimentacoes m ON m.id = a.financeiro_movimentacao_id
WHERE a.origem = 'reajuste'
  AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_arquivos fa WHERE fa.anexo_financeiro_id = a.id
  );