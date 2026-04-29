## Objetivo

Na aba **Empresas**, a coluna "Emissão Fatura" (e o card de detalhe "Emissão da Fatura") passará a refletir o `dia_emissao` da movimentação financeira mais recente da empresa, mantendo o campo `data_emissao_fatura` do cadastro como fallback quando não houver movimentação com emissão preenchida.

## Mudanças

### 1. Buscar o `dia_emissao` mais recente por empresa (`src/pages/Empresas.tsx`)
- Adicionar uma nova query React Query que busca em `financeiro_movimentacoes` os registros com `dia_emissao IS NOT NULL`, ordenados por `mes_referencia` desc, e monta um mapa `empresa_id → dia_emissao` com o mais recente de cada empresa.
- Chave da query: `["empresas-dia-emissao-financeiro"]`, com `staleTime` curto e invalidada junto das demais queries de empresas/financeiro.

### 2. Exibir o valor na tabela e no detalhe
- Na linha da tabela (linha ~622), substituir `formatDay(e.data_emissao_fatura)` por:
  - `formatDay(mapDiaEmissao[e.id] ?? e.data_emissao_fatura)`
- No painel de detalhe (linha ~676), aplicar a mesma lógica.
- Sem alteração visual além do número exibido.

### 3. Cadastro continua igual
- O campo "Dia Emissão Fatura (1-31)" do formulário de empresa permanece como está (entrada/edição normal). Ele continua sendo persistido em `empresas.data_emissao_fatura` e usado como fallback quando a empresa ainda não tem movimentação no Financeiro com `dia_emissao`.

### 4. Invalidação de cache
- Quando o `EditarMovimentacaoDialog` salva uma alteração de `dia_emissao`, garantir que a nova query de empresas seja invalidada (ajustar a lista de `invalidateQueries` no fluxo de salvar do Financeiro).

## Detalhes técnicos

- A consulta usa apenas `select('empresa_id, dia_emissao, mes_referencia').not('dia_emissao','is',null).order('mes_referencia',{ascending:false})` e dedup no client por `empresa_id`.
- Nenhuma migração de banco é necessária; nenhum dado é movido entre tabelas.
- `formatDay` continua sendo o utilitário usado para padronizar o dia em 2 dígitos.

## Fora de escopo

- Alterar a aba Financeiro, o cadastro de empresa, ou outras telas que leem `data_emissao_fatura` (Dashboard, Executivas, StatusChart, etc.). Apenas a aba Empresas será ajustada.
