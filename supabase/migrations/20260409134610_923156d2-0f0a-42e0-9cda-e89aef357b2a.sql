
-- Fix IMPLAMERICA (data_corte=30, correct period is 25-30)
UPDATE movimentacoes 
SET periodo = '25-30', tipo_movimentacao = 'Diária'
WHERE empresa_id = (SELECT id FROM empresas WHERE nome ILIKE '%IMPLAMERICA%' LIMIT 1)
AND periodo != '25-30';

-- Fix INDUSTRIAS REUNIDAS VITORIA REGIA (data_corte=5, correct period is 01-05)
UPDATE movimentacoes 
SET periodo = '01-05', tipo_movimentacao = 'Diária'
WHERE empresa_id = (SELECT id FROM empresas WHERE nome ILIKE '%VITORIA REGIA%' LIMIT 1)
AND periodo != '01-05';

-- Remove duplicate April 2026 entry for VITORIA REGIA (keep only one)
DELETE FROM movimentacoes 
WHERE id IN (
  SELECT id FROM movimentacoes 
  WHERE empresa_id = (SELECT id FROM empresas WHERE nome ILIKE '%VITORIA REGIA%' LIMIT 1)
  AND mes_referencia = '2026-04'
  ORDER BY created_at DESC
  LIMIT 1
);

-- Fix SENSE INDUSTRIA DE BICICLETAS (data_corte=5, correct period is 01-05)
UPDATE movimentacoes 
SET periodo = '01-05', tipo_movimentacao = 'Diária'
WHERE empresa_id = (SELECT id FROM empresas WHERE nome ILIKE '%SENSE INDUSTRIA DE BICICLETAS%' LIMIT 1)
AND periodo != '01-05';

-- Remove duplicate April 2026 entry for SENSE
DELETE FROM movimentacoes 
WHERE id IN (
  SELECT id FROM movimentacoes 
  WHERE empresa_id = (SELECT id FROM empresas WHERE nome ILIKE '%SENSE INDUSTRIA DE BICICLETAS%' LIMIT 1)
  AND mes_referencia = '2026-04'
  ORDER BY created_at DESC
  LIMIT 1
);
