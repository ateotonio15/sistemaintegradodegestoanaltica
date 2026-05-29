# Casar CNPJ do pagador pela aba RESUMO

## Causa

A planilha do contrato (ex.: `FATURAMENTO - GNL BRASIL JUNHO2026.xlsx`) tem 4 abas:

- `RELATORIO BENEFICIARIOS` — 1 linha por beneficiário, com `Contrato`, `Contratante`, `Plano`, `Mensalidade`. **Não tem coluna de CNPJ.**
- `ADESAO`, `EXCLUSAO ` — adesões/exclusões do mês.
- `RESUMO` — bloco com `Empresa/Módulo`, `Qtd`, `Mensalidade`, `Valor` e a linha do pagador no formato `GNL BRASIL LOGISTICA S.A 47.548.779/0001-48`.

Hoje `analisarExcelFinanceiroPorCnpj` só lê `wb.worksheets[0]` (a aba de beneficiários). Como ali não há coluna CNPJ, o bloco é criado com `cnpj = ""`, agrupado só por nome. Depois `filtrarPorPagador` busca pelo CNPJ cadastrado, não acha e cai no placeholder "CNPJ ... não localizado na planilha do contrato" / "Nenhuma categoria identificada".

## O que muda

Enriquecer os blocos com o CNPJ extraído da aba `RESUMO` (e como fallback `ADESAO`/`EXCLUSAO`), casando pelo nome do pagador. Sem mudar a lógica de classificação de planos nem de inclusões/exclusões — o `Master Empresarial` já é classificado como Enfermaria pelo classificador atual.

### Em `src/lib/excel-analysis-utils.ts`

1. Adicionar helper `extrairCnpjsPorNome(wb)` que percorre todas as worksheets e:
   - Faz match do regex `\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b` em qualquer célula string.
   - Para cada match, pega o trecho antes do CNPJ (mesma célula ou célula vizinha à esquerda) como "nome do pagador" e normaliza com `norm(...)`.
   - Devolve um `Map<string, string>` de `nomeNormalizado → cnpj14dig`.
   - Prioriza a aba cujo nome contenha `resumo`.

2. Em `analisarExcelFinanceiroPorCnpj`, após montar `blocos`:
   - Para cada bloco sem `cnpj`, tentar casar `norm(bloco.nome)` com as chaves do mapa (igualdade, `includes` em qualquer direção). Se casar, preencher `bloco.cnpj` e `bloco.nomeExibicao = formatNomeComCnpj(bloco.nome, cnpj)`.
   - Remover/atualizar o aviso `"CNPJ não identificado nesta linha — usando apenas o nome."` quando enriquecido.

3. Manter `analisarExcelFinanceiroPorPagador` (filtro por pagador único) inalterado por enquanto — o consumo no fluxo "por CNPJ" passa a funcionar via passo 2.

## Arquivos afetados

- `src/lib/excel-analysis-utils.ts` — novo helper + enriquecimento dos blocos.

Sem mudanças de schema, RLS, UI ou edge functions.
