
## Objetivo

Quando uma empresa tiver pagadores cadastrados, a análise do Excel deve gerar **um resultado por pagador**, filtrando as linhas da planilha pelo **CNPJ** (prioridade) ou pelo **nome do Pagador** (fallback). Assim, cada linha expandida na tabela mostra os valores corretos daquele pagador específico — não o total agregado.

## Comportamento esperado

- **Empresa SEM pagadores cadastrados**: nada muda. Continua mostrando a análise do arquivo inteiro como hoje.
- **Empresa COM pagadores cadastrados**:
  - **Linha mãe** (empresa principal): continua exibindo o **total agregado** do Excel inteiro (todas as linhas).
  - **Cada linha de pagador**: exibe **somente** as linhas do Excel cujo CNPJ casa com o CNPJ do pagador; se o Excel não tiver coluna CNPJ ou o CNPJ não bater, usa a coluna "Pagador" (nome) como fallback.

## Mudanças no código

### 1. `src/lib/excel-analysis-utils.ts`
- Adicionar reconhecimento das colunas **CNPJ** e **Pagador** ao lado das colunas atuais (Plano, Tipo Cobrança, Valor):
  - `COL_CNPJ = ["cnpj", "cnpj pagador", "cnpj do pagador"]`
  - `COL_PAGADOR = ["pagador", "nome pagador", "nome do pagador", "razao social", "razão social"]`
- Adicionar utilitário `normalizarCnpj(s)` que remove tudo que não é dígito.
- Criar nova função `analisarExcelFinanceiroPorPagador(buffer, filtro?)`:
  - `filtro` opcional: `{ cnpj?: string; nome?: string }`.
  - Se `filtro` ausente → comportamento atual (agregado).
  - Se `filtro` presente → ao iterar as linhas, pula a linha quando:
    - Houver coluna CNPJ E `filtro.cnpj` informado → comparar CNPJs normalizados; se não bater, pula.
    - Senão, se houver coluna Pagador E `filtro.nome` → comparar por `norm()` (igualdade ou `includes`); se não bater, pula.
    - Se o arquivo não tem nenhuma das duas colunas → retorna agregado igual ao atual e adiciona aviso "Não foi possível separar por pagador".
- Manter `analisarExcelFinanceiro` como wrapper que chama a nova função sem filtro (compatibilidade).
- Replicar o mesmo padrão de filtro em `src/lib/excel-analysis-moto-honda.ts` (parser RESUMO Moto Honda).

### 2. `src/pages/Financeiro.tsx` (função `runAnalise`, linhas ~540-690)
- Hoje a análise é cacheada por `row.id` (id da movimentação). Passar a cachear por `rowKey` para que cada pagador tenha seu próprio resultado.
- Para cada `xlsAnexo`, gerar **N+1 análises**:
  - 1 análise agregada (sem filtro) → resultado da linha mãe.
  - 1 análise por pagador cadastrado ativo da empresa → cada uma com `{ cnpj, nome }` do pagador.
- Armazenar em `analiseResultados[rowKey]` o array correspondente daquela linha (mãe = agregado; pagador = filtrado).
- Mesma lógica para `analiseComparacoes[rowKey]` (a comparação com PDF continua usando o resultado já filtrado do Excel; PDF permanece inteiro, pois geralmente vem por pagador como arquivo separado — manter a associação por índice atual).
- Bloco de geração automática de "A Receber" (linha ~688): continuar usando o **agregado** da empresa-mãe (não duplicar com pagadores). Garantir que só rode uma vez por movimentação (não uma vez por pagador).

### 3. `src/components/financeiro/AnaliseExcelRow.tsx` e `FinanceiroTable.tsx`
- `FinanceiroTable.tsx` já passa `analiseResultados[rowKey]` como fallback de `analiseResultados[row.id]` — ajustar para priorizar `rowKey`.
- Sem mudanças visuais; o componente apenas recebe o resultado correto por linha.

## Casos de borda / avisos

- Excel sem coluna CNPJ nem Pagador + empresa com pagadores → linhas de pagador mostram aviso "Não foi possível separar por pagador (planilha sem coluna CNPJ ou Pagador)". A linha mãe continua com o agregado.
- CNPJ do pagador cadastrado vazio → cai no fallback por nome.
- Pagador cadastrado sem nenhuma linha correspondente → mostra resultado zerado + aviso "Nenhuma linha encontrada para este pagador".
- Reanálise (botão "Reanalisar") continua funcionando — invalida o cache pelo `rowKey`.

## Sem mudanças

- Estrutura do banco (`financeiro_pagadores` já tem `cnpj` e `nome_pagador`).
- RLS, edge functions, expansão da tabela, KPIs.
- Comportamento da aba Empresas, Dashboard, Movimentações.
