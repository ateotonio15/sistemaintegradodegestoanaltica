## Objetivo

Mostrar a lista de **contratos** (não vidas) onde a classificação é igual a **4**, a partir do endpoint autenticado `/vidas-contrato` da API Samel.

## Observação importante sobre o campo

A API `/vidas-contrato` que o projeto consome hoje retorna `DS_CLASSIFICACAO` (texto). Não há campo `CD_CLASSIF_CONTRATO` no payload conhecido. Vou tratar o filtro como **classificação = "4"** comparando contra `DS_CLASSIFICACAO` (igualdade exata + também conferindo se a string começa com `"4"` ou contém `"4 -"`, padrão comum em códigos da Samel tipo `"4 - EMPRESARIAL"`).

Se quando rodar a primeira chamada o valor real vier diferente (ex.: `CD_CLASSIF_CONTRATO` separado), eu ajusto o filtro — mas a estrutura da tela continua igual.

## Onde aparece

Nova aba **"Contratos por classificação"** dentro de `/vidas` (página `VidasSamel`), ao lado da listagem atual de vidas. Mantém o mesmo login/credenciais já usados.

## O que a aba mostra

Tabela de contratos únicos (deduplicados por `NR_CONTRATO`) com colunas:

- NR_CONTRATO
- NM_ESTIPULANTE
- DS_CLASSIFICACAO (valor cru, pra você conferir o "4")
- DT_CONTRATO
- Qtde de vidas no contrato (contagem após dedupe)
- Situação predominante

Filtro fixo no topo: **Classificação =** `4` (editável; default `4`).
Busca livre por nome do estipulante / nº contrato.
Botão **Exportar CSV** da lista filtrada.

## Como os dados são obtidos

`/vidas-contrato` é paginado por vidas, não por contrato. Para listar contratos:

1. Buscar página a página (`pageSize=500`) **todas** as vidas (ou até atingir limite configurável — default 20.000 vidas).
2. Filtrar localmente por classificação = `4`.
3. Agrupar por `NR_CONTRATO` para produzir a lista de contratos.

Cache via React Query (`staleTime: 10min`), com botão **Atualizar**.

## Arquivos afetados (resumo técnico)

- `src/lib/vidasSamelApi.ts` — nova função `listAllVidasParaContratos({ classificacao, maxRows })` que pagina e devolve `Beneficiario[]`.
- `src/pages/VidasSamel.tsx` — adicionar `Tabs` (Vidas | Contratos por classificação) e novo componente interno `ContratosClassificacaoTab`.
- Sem mudanças de banco. Sem mudanças na edge function.

## Fora do escopo

- Não altera o card `VidasOperadoraResumo` nem `/vidas-operadora`.
- Não cria nova rota nem nova tabela no Supabase.
