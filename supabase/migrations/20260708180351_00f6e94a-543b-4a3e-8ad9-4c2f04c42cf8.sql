
-- Devolve as empresas para Maria Moreira
UPDATE public.empresas e
SET responsavel_user_id = fce.responsavel_original_user_id
FROM public.ferias_cadastro_empresas fce
WHERE fce.empresa_id = e.id
  AND fce.ferias_id = '97bde9b8-5bcb-4318-a4e1-19a8faf72a3f'
  AND fce.status = 'aguardando_fechamento';

-- Marca as linhas como retornadas
UPDATE public.ferias_cadastro_empresas
SET status = 'retornada',
    retornada_em = now(),
    motivo_retencao = NULL
WHERE ferias_id = '97bde9b8-5bcb-4318-a4e1-19a8faf72a3f'
  AND status = 'aguardando_fechamento';

-- Encerra o registro de férias
UPDATE public.ferias_cadastro
SET status = 'encerrada',
    encerrada_em = now()
WHERE id = '97bde9b8-5bcb-4318-a4e1-19a8faf72a3f';
