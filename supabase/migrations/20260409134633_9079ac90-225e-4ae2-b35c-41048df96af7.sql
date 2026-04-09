
-- Remove duplicate April 2026 for IMPLAMERICA
DELETE FROM movimentacoes 
WHERE id IN (
  SELECT id FROM movimentacoes 
  WHERE empresa_id = (SELECT id FROM empresas WHERE nome ILIKE '%IMPLAMERICA%' LIMIT 1)
  AND mes_referencia = '2026-04'
  ORDER BY created_at DESC
  LIMIT 1
);

-- Fix VITORIA REGIA tipo_movimentacao to Diária for all months
UPDATE movimentacoes 
SET tipo_movimentacao = 'Diária'
WHERE empresa_id = (SELECT id FROM empresas WHERE nome ILIKE '%VITORIA REGIA%' LIMIT 1)
AND tipo_movimentacao != 'Diária';
