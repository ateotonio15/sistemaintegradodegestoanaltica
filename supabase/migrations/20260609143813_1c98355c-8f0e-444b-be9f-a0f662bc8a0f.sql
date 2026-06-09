-- Backfill: replicar dia_emissao e data_vencimento existentes na movimentação
-- "origem" para todos os contratos do mesmo grupo financeiro, no mesmo
-- mês/período. Corrige casos em que a replicação não ocorreu (ex.: contratos
-- com múltiplos pagadores que entravam no fluxo de pagadores e pulavam a
-- replicação ao grupo).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (gfc.grupo_id, fm.mes_referencia, fm.periodo)
      gfc.grupo_id, fm.id AS mov_id, fm.dia_emissao, fm.data_vencimento,
      fm.mes_referencia, fm.periodo
    FROM public.financeiro_movimentacoes fm
    JOIN public.grupos_financeiros_contratos gfc
      ON gfc.empresa_id = fm.empresa_id AND gfc.ativo = true
    WHERE fm.dia_emissao IS NOT NULL OR fm.data_vencimento IS NOT NULL
    ORDER BY gfc.grupo_id, fm.mes_referencia, fm.periodo, fm.updated_at DESC
  LOOP
    UPDATE public.financeiro_movimentacoes fm2
       SET dia_emissao = COALESCE(fm2.dia_emissao, r.dia_emissao),
           data_vencimento = COALESCE(fm2.data_vencimento, r.data_vencimento),
           updated_at = now()
      FROM public.grupos_financeiros_contratos gfc2
     WHERE gfc2.grupo_id = r.grupo_id
       AND gfc2.ativo = true
       AND fm2.empresa_id = gfc2.empresa_id
       AND fm2.mes_referencia = r.mes_referencia
       AND fm2.periodo = r.periodo
       AND (
         (r.dia_emissao IS NOT NULL AND fm2.dia_emissao IS NULL)
         OR (r.data_vencimento IS NOT NULL AND fm2.data_vencimento IS NULL)
       );
  END LOOP;
END $$;