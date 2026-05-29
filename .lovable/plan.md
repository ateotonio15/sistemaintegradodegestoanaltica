## Objetivo
Exibir as tabelas "Movimentações no Período" e "Enviadas ao Financeiro" do Dashboard em ordem alfabética pelo nome da empresa.

## Alterações
Arquivo: `src/pages/Dashboard.tsx`

- Ordenar `listaTrabalho` e `listaConcluidas` por `empresas.nome` (A-Z) usando `localeCompare` com locale `pt-BR` e `sensitivity: "base"` (ignora acentos/maiúsculas).
- Aplicar a ordenação no momento do render das duas tabelas (sem alterar fontes de dados nem queries), preservando demais comportamentos (status, filtros de período/mês, edição).

Sem mudanças de schema, queries ou outras telas.