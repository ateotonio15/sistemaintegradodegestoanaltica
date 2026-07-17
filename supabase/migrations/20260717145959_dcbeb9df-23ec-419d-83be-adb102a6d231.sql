-- Sincroniza responsavel_movimentacao das movimentações com o responsável atual da empresa,
-- exceto para empresas cujo responsável está atualmente em férias (para preservar a redistribuição).
UPDATE public.movimentacoes m
SET responsavel_movimentacao = COALESCE(p.display_name, e.responsavel_contrato),
    updated_at = now()
FROM public.empresas e
LEFT JOIN public.profiles p ON p.user_id = e.responsavel_user_id
WHERE m.empresa_id = e.id
  AND COALESCE(p.display_name, e.responsavel_contrato) IS NOT NULL
  AND COALESCE(p.display_name, e.responsavel_contrato) IS DISTINCT FROM m.responsavel_movimentacao
  AND (
    e.responsavel_user_id IS NULL
    OR e.responsavel_user_id NOT IN (
      SELECT responsavel_original_user_id
      FROM public.ferias_cadastro
      WHERE status IN ('em_andamento','programada','aguardando_retorno_contratos')
    )
  );