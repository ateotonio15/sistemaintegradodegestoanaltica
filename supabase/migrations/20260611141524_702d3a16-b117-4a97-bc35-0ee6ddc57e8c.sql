
-- 1) ROYAL MAX: migra env+fin do errado (15-20) para o correto vazio (20-25)
UPDATE public.movimentacoes
SET data_envio_empresa = '2026-05-20', data_envio_financeiro = '2026-06-02'
WHERE id = '87512858-1fe7-458c-a704-4d763d3c4c8e';

-- 2) TPX 06/2026: migra env+fin do errado (05-10) para o correto vazio (01-05)
UPDATE public.movimentacoes
SET data_envio_empresa = '2026-06-09', data_envio_financeiro = '2026-06-09'
WHERE id = '93449b05-bd96-46f9-a364-d5cb65fbc5db';

-- 3) TPX 05/2026: sem contraparte → apenas corrige o período
UPDATE public.movimentacoes
SET periodo = '01-05', data_envio_empresa = NULL
WHERE id = 'a75973db-e9e6-4b2b-86a3-a000c61b508a';
-- (data 0206-05-07 estava corrompida; usuário poderá relançar)

-- 4) Remove os registros errados/duplicados
DELETE FROM public.movimentacoes
WHERE id IN (
  '1dc860d6-840f-4d3d-bc46-fd299b9f1d77', -- T3M 10-15
  '29e7e3c6-e0ff-4ebe-96ed-cd5ee15bc60a', -- TPX 06 05-10
  '8a743e0c-8f9f-4e8e-b648-db2b8502dfe8', -- CALOI 01-05 (lixo)
  'd1c8a5d8-775c-44e9-bdbd-29cd9ab0bbd5', -- ITP 10-15
  '2d801d1a-7b6f-4991-85f9-73acc61303c2', -- ROYAL MAX 15-20
  '3ade7f05-0066-41aa-bc0f-4c9de04980e3', -- PROCARGO 10-15
  '294f293e-ed8c-40de-bf2c-245f5a9cf201'  -- SENSE 10-15
);
