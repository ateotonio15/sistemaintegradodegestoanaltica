# Ajuste da lógica de "Contratos pendentes"

## 1. Nova definição de contrato pendente

Hoje o card conta toda movimentação financeira sem nota/faturamento, de qualquer competência — por isso o número 738.

Nova regra: uma movimentação só é considerada **pendente** quando o período de movimentação dela já venceu há mais de 1 dia.

- Período `01-05` → vira pendente a partir do dia **07**
- `05-10` → dia **12**
- `10-15` → dia **17**
- `15-20` → dia **22**
- `20-25` → dia **27**
- `25-30` → dia **01 do mês seguinte**

Competências de meses já encerrados entram integralmente (todos os períodos já venceram).

## 2. Janela de competências contabilizadas

O card e a lista passam a considerar apenas **mês vigente + mês anterior** (hoje: agosto e julho; em setembro: setembro e agosto).

Os filtros de competência continuam listando **todas** as competências existentes — se o usuário selecionar manualmente uma competência antiga, a lista mostra aquela seleção normalmente (a janela padrão só se aplica quando nenhum filtro está marcado).

Efeito prático hoje (04/08): agosto ainda não tem nenhum período vencido +1 dia, então o número passa a refletir essencialmente as pendências de julho — cerca de 60 registros antes dos filtros de anexo/envio, no lugar de 738.

## 3. Relatórios Excel e PDF

- Remover a coluna **CNPJ do pagador** dos dois relatórios.
- **Excel**: cabeçalho estilizado (faixa escura, texto branco), linhas zebradas, bordas leves, altura de linha e larguras ajustadas, congelamento do cabeçalho, autofiltro e uma linha de resumo no topo com filtros aplicados, total e data de emissão. Aba adicional "Resumo" com contagem por competência e por período.
- **PDF**: cabeçalho com título, bloco de filtros organizado em linhas legíveis (em vez de uma linha corrida), tabela com colunas redimensionadas após a remoção do CNPJ, zebrado, rodapé com paginação ("Página X de Y") e data de emissão em todas as páginas.

## Detalhes técnicos

Arquivo único: `src/components/dashboard/DashboardFinanceiro.tsx`

- Nova função auxiliar (em `src/lib/financeiro-utils.ts`) `periodoVencido(mesReferencia, periodo, hoje)` que aplica o mapa fim-do-período + 2 dias e retorna `true` para competências passadas.
- Query `fin-dash-pendentes`: aplicar o filtro de vencimento e a janela mês vigente/anterior sobre o resultado, mantendo os filtros atuais (sem `data_envio_nota`, sem `faturamento_iniciado_em`, sem anexo relevante, sem envio operacional).
- `pendentesFiltrados`: quando `competenciasSel` estiver vazio, usar a janela padrão; quando houver seleção, respeitar a seleção do usuário.
- Badge do card `pendentes` passa a usar a mesma contagem da janela padrão.
- `exportarPendentes` / `exportarPendentesPDF`: remover chave `cnpj` e aplicar a nova formatação.
