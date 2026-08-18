# Remover movimentação de agosto — RIO NEGRO EMBALAGENS LTDA (2541)

## Situação atual (verificada)
- Contrato 2541, implantação em **11/08/2026**, tipo **Diária**, data de corte **25**.
- Existe **1 linha** em movimentações: competência **2026-08**, período **10-15**, sem envio à empresa, sem envio ao financeiro, responsável Rose Deodato — hoje aparece como "Fora do prazo".

Como a implantação ocorreu já dentro da janela 10-15, o contrato só deve fechar movimentação a partir da próxima competência.

## O que será feito
- Excluir essa única linha de movimentação de agosto/2026 do contrato 2541.
- A linha de setembro será gerada normalmente pelo fluxo padrão de geração de movimentações.

## Detalhes técnicos
- Operação de dados (delete) na tabela `movimentacoes`, filtrando por `empresa_id = af5637a8-136a-4f07-a6c8-b0aa4ac7bf12`, `mes_referencia = '2026-08'` e `periodo = '10-15'`.
- Sem alteração de código ou de esquema.
