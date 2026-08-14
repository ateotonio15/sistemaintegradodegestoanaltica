# Ajuste no cálculo de exclusões de empresas com "período"

## Problema confirmado

Na planilha SODECIA (ciclo iniciando dia 20, competência de faturamento 01/08/2026), a exclusão de **JEICIENE LIMA DA SILVA** (rescisão 16/07/2026) saiu com **-29,77**.

O cálculo atual monta o ciclo em torno da *data da rescisão*: como 16 é menor que 19, ele fecha o ciclo em **19/07**, com ciclo 20/06–19/07 (30 dias) e apenas 4 dias proporcionais.

O correto, segundo a regra do faturamento: toda exclusão processada nesta remessa deve ser cobrada até o fim do **ciclo que está sendo faturado** (20/07 a 19/08), independentemente de a rescisão ter ocorrido em julho ou agosto.

- Período: 16/07 a 19/08 = 35 dias
- Ciclo 20/07–19/08 = 31 dias
- 223,26 / 31 × 35 = **252,07** (valor esperado)

Exclusões de agosto continuam corretas (ex.: 05/08 → até 19/08, base 31 dias), pois usam o mesmo ciclo de referência.

## O que será ajustado

Em `src/lib/faturamento-exclusoes.ts`, na função `calcularProporcionalPeriodo`:

1. Passar a receber o **ciclo de referência da remessa** (fim do ciclo), em vez de deduzi-lo da data de rescisão.
2. O fim do ciclo passa a ser calculado como `dia (inicioCiclo - 1)` no **mês da competência mais recente do arquivo bruto** (no exemplo: 19/08/2026). Quando o ciclo inicia no dia 01, mantém-se o último dia do mês.
3. O início do ciclo é o dia seguinte ao fim do ciclo anterior (20/07/2026), e o divisor passa a ser a duração real desse ciclo (31 dias).
4. Dias proporcionais = da data de rescisão até o fim do ciclo de referência, inclusive.
5. Se a rescisão for posterior ao fim do ciclo de referência (caso raro de lançamento adiantado), o ciclo avança para a próxima ocorrência, preservando o comportamento atual.
6. Sem competência legível no bruto, mantém-se o comportamento atual como fallback.

O caminho de empresas **sem** período específico (divisão pelos dias do mês da rescisão) não muda.

## Verificação

Após o ajuste, revalido o cenário JEICIENE (16/07 → -252,07) e uma exclusão de agosto (ex.: 05/08 → 15 dias / 31) recalculando a planilha enviada.
