## Objetivo

Hoje a comparação entre faturamento (Excel) e notas fiscais (PDF) é feita por pagador cadastrado (nome/CNPJ). Quando há vários CNPJs com o mesmo nome (caso APOEMA), a planilha é agregada incorretamente e CNPJs sem NF não aparecem como pendência. O plano abaixo reescreve essa lógica para usar **CNPJ como chave única**, ignorar pagadores cadastrados como filtro e detectar automaticamente todas as filiais presentes na planilha.

## O que muda na prática

1. O analisador percorre a planilha e separa as linhas por CNPJ. Cada CNPJ vira um "bloco" de análise (Enfermaria / Apartamento / Inclusões / Exclusões).
2. Cada PDF anexo é validado pelo seu **CNPJ do tomador**, casando 1-para-1 com o bloco daquele CNPJ.
3. Se um CNPJ aparece no Excel mas não tem PDF correspondente → bloco marcado como **"NF não localizada para este CNPJ"** (vermelho, com valor e nome).
4. Se um PDF tem CNPJ que não aparece no Excel → aparece em um **bloco extra de divergência** ("NF sem CNPJ correspondente no faturamento"), mostrando arquivo, CNPJ do tomador e valor da NF.
5. O nome do pagador passa a ser sempre exibido como **`NOME — 0001-69`** (os 6 últimos dígitos do CNPJ formatados), eliminando ambiguidade.
6. Nome igual com CNPJ diferente nunca gera divergência de nome — são tratados como filiais.

## Mudanças por arquivo

### `src/lib/excel-analysis-utils.ts`
- Nova função `analisarExcelFinanceiroPorCnpj(buffer)` que retorna um array `AnalisePorCnpj[]`:
  ```ts
  interface AnalisePorCnpj {
    cnpj: string;           // 14 dígitos, normalizado
    nome: string;           // nome do pagador como aparece no Excel
    nomeExibicao: string;   // "NOME — 0001-69"
    enfermaria, apartamento, inclusoes, exclusoes?
    avisos: string[];
  }
  ```
- Helper `formatCnpjSufixo(cnpj)` → `"0001-69"` (a partir dos dígitos 9-14).
- Helper `formatNomeComCnpj(nome, cnpj)` → `"APOEMA RESTAURANTES LTDA — 0001-69"`.
- Mantém `analisarExcelFinanceiroPorPagador` como wrapper (compatibilidade Moto Honda / chamadas legadas).
- Nova função de comparação `cruzarExcelComPdfs(blocosExcel, pdfs)` que devolve:
  - `comparacoes`: 1 entrada por bloco do Excel (com PDF casado por CNPJ ou nulo)
  - `notasOrfas`: PDFs cujo `tomadorCnpj` não bate com nenhum bloco do Excel
- `ComparacaoResultado` ganha campos `cnpj`, `nomeExibicao`, `motivoSemPdf` (ex.: `"NF não localizada para este CNPJ"`).

### `src/lib/pdf-analysis-utils.ts`
- Mantém `extrairTomador` (já normaliza CNPJ para 14 dígitos). Sem mudanças funcionais; só garantir que `tomadorCnpj` esteja sempre presente quando detectado.

### `src/pages/Financeiro.tsx` (função que orquestra a análise, linhas ~620–820)
- Remover o caminho atual baseado em `filtroPagador` (CNPJ/nome do pagador cadastrado).
- Para cada `xlsAnexo` (geralmente 1), chamar `analisarExcelFinanceiroPorCnpj` → obtém N blocos.
- Para cada bloco: encontrar PDF cujo `tomadorCnpj` (14 dígitos) seja igual ao CNPJ do bloco; sem match → comparação com `arquivoPdf: null` e `motivoSemPdf`.
- PDFs não casados após o loop → entram em `notasOrfas` (lista que será mostrada como bloco extra).
- A persistência em `financeiro_analises` passa a salvar 1 registro por CNPJ encontrado no Excel (`pagador_cnpj` = 14 dígitos, `pagador_nome` = nome exibido com sufixo). Mantém também 1 registro para cada NF órfã (com `pagador_cnpj` do tomador e flag de divergência).
- A regra "linha mãe + linha por pagador cadastrado" da tabela continua existindo só como agrupamento visual da linha do financeiro (não interfere mais na análise). A análise é executada uma vez por movimentação (linha mãe) e o resultado contém todos os CNPJs.

### `src/components/financeiro/AnaliseExcelRow.tsx`
- O cabeçalho de cada bloco passa a mostrar `Pagador: {nomeExibicao}` (com sufixo `— 0001-69`).
- Quando o bloco vier sem PDF casado, mostrar alerta vermelho **"NF não localizada para este CNPJ"** logo abaixo do cabeçalho (em vez de só "Validado contra: —").
- Nova seção opcional `Notas fiscais sem CNPJ correspondente no faturamento`, renderizada uma vez no fim do componente quando `notasOrfas.length > 0`. Cada item lista: arquivo, CNPJ do tomador (formatado), nome do tomador e valor líquido da NF.

### `src/components/financeiro/EditarMovimentacaoDialog.tsx` e `src/components/dashboard/PrevisaoFinanceira.tsx`
- Atualizar imports e chamadas para usar a nova API quando aplicável (mantêm comportamento atual; provável só ajuste de tipos).

## Sem mudanças

- Banco de dados: a tabela `financeiro_analises` já tem colunas `pagador_cnpj` e `pagador_nome` suficientes. Sem migração.
- Cadastro de pagadores (`financeiro_pagadores`): permanece intacto. Continua sendo usado para definir linhas/visualização e relatórios; só não controla mais qual CNPJ a análise considera.
- Fluxo Moto Honda (`analisarExcelMotoHonda` + análise simplificada) permanece como está: continua usando comparação simplificada por arquivo (não há quebra por CNPJ nesse fluxo).

## Validação esperada (caso APOEMA)

- Excel com 6 CNPJs APOEMA → 6 blocos.
- 5 PDFs anexados com tomadores casando 5 dos CNPJs → 5 blocos verdes.
- CNPJ `04.739.000/0002-40` (R$ 3.559,13) sem PDF → bloco vermelho com **"NF não localizada para este CNPJ"**.
- Nenhuma NF órfã (porque todos os PDFs casaram).
