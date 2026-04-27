ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_tipo_financeiro_check;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_tipo_financeiro_check
  CHECK (tipo_financeiro IS NULL OR tipo_financeiro IN (
    'NÃO-PRORATA',
    'INCLUSÃO',
    'INCLUSÃO/EXCLUSÃO',
    'INCLUSÃO/EXCLUSÃO/COPAR',
    'TAXA ADESÃO',
    '30 dias'
  ));