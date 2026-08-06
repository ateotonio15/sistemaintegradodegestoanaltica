# Dashboard Geral — nova versão só com gráficos

Substituir todo o conteúdo do Dashboard Geral (`/dashboard/geral`) por uma visão analítica composta apenas de gráficos, mantendo no topo os filtros de Competência (mês) e Período (01-05, 05-10, ...).

## O que a tela passa a mostrar

1. **Empresas por tipo de movimentação** — barras com a quantidade de empresas agrupadas por tipo de movimentação do contrato (Inclusão, Inclusão/Exclusão, etc.), no mês/período filtrado.
2. **Status das movimentações** — rosca/barras com Pendentes (aguardando envio + fora do prazo), Enviadas para Empresa e Enviadas ao Financeiro, com o total no centro.
3. **Vidas em tempo real** — cartões-gráfico com total geral de vidas e o recorte somente Empresarial, atualizados em tempo real (Realtime já ativo para `empresas`).
4. **Entradas e saídas de vidas por mês** — barras dos últimos 12 meses com entradas e saídas, mais linha de vidas ativas.
5. **Empresas com movimentação por mês** — série mensal com a quantidade de empresas que tiveram movimentação registrada.

Tudo que existe hoje na página (tabela de movimentações, cards de alertas, modais de edição, cards de implantação, botão de férias, busca global, filtros de responsável/corretora/tipo) sai desta tela. Esses recursos continuam disponíveis nas abas próprias (Movimentações, Implantação, Financeiro).

## Detalhes técnicos

- Reescrever `src/pages/Dashboard.tsx` como página enxuta: filtros (mês/período) + grid de gráficos.
- Dados:
  - `movimentacoes` (join `empresas`) filtradas por `mes_referencia` e `periodo`; status via `calcularStatus` de `src/lib/movimentacao-utils.ts`.
  - `empresas` para vidas: soma de `vidas` das ativas (geral) e das ativas com `tipo_contrato = 'EMPRESARIAL'`.
  - `vidas_historico_administradoras` (`entradas`, `saidas`, `total_atual`) nos últimos 12 meses para o gráfico de entradas/saídas — mesma fonte usada por `useGestaoVidas`.
  - Série mensal de empresas com movimentação: contagem distinta de `empresa_id` por `mes_referencia` nos últimos 12 meses.
- Gráficos com `recharts` (já usado no projeto), cores por tokens semânticos (`--success`, `--warning`, `--destructive`, `--primary`) — sem cores fixas.
- Manter a subscrição Realtime existente em `empresas` e adicionar a mesma para `movimentacoes`, com cleanup no unmount.
- Novos componentes em `src/components/dashboard/` (um arquivo por gráfico) para manter a página curta; reaproveitar `EmpresasStatusChart.tsx` como base do gráfico de status.
- Sem alterações de banco de dados.
