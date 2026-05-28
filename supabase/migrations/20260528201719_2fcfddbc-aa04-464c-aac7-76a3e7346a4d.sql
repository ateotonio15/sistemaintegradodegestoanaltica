
-- Remove movimentações duplicadas, mantendo a melhor (mais campos preenchidos, depois mais antiga)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id, mes_referencia, periodo
      ORDER BY
        ((data_envio_empresa IS NOT NULL)::int
        + (data_retorno_empresa IS NOT NULL)::int
        + (data_envio_financeiro IS NOT NULL)::int) DESC,
        created_at ASC
    ) AS rn
  FROM public.movimentacoes
  WHERE empresa_id IS NOT NULL
)
DELETE FROM public.movimentacoes
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Prevenir duplicações futuras
CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_empresa_mes_periodo_uniq
  ON public.movimentacoes (empresa_id, mes_referencia, periodo)
  WHERE empresa_id IS NOT NULL;
