## Objetivo
Na aba **Financeiro**, fazer a coluna **Período / Corte** sempre exibir o tipo da empresa (Diária ou Fechada) seguido do sub-período da linha (`01-05`, `05-10`, `10-15`, `15-20`, `20-25`, `25-30`), como no exemplo enviado: `Fechada — 01-05`.

Isso também resolve o efeito visual de "duplicidade" do contrato 2150, porque cada linha passará a mostrar seu próprio sub-período (uma `Diária — 15-20` e outra `Diária — 20-25`), deixando claro que são períodos distintos.

## O que muda

Arquivo: `src/pages/Financeiro.tsx` (bloco que monta `periodoCorte`, linhas ~528-545).

Hoje:
- Diária → `Diária — corte dia 25`
- Fechada → `Fechada — 01-05`
- Período específico de cobrança (30 dias) → `Período de: 05/06/2026 à 04/07/2026`

Depois:
- Diária → `Diária — {f.periodo}` (ex.: `Diária — 20-25`)
- Fechada → `Fechada — {f.periodo}` (ex.: `Fechada — 01-05`)
- Empresa sem tipo configurado → `— {f.periodo}` (mostra ao menos o sub-período)
- Período específico de cobrança (regra atual mantida, pois é intervalo de 30 dias e não usa sub-períodos)

A fonte do sub-período é o campo `periodo` da própria movimentação financeira (`f.periodo`), que já existe na linha.

## Onde NÃO mexer
- Lógica de provisionamento (`provisionarMutation`) permanece igual.
- Demais colunas e filtros permanecem iguais.
- Exportação CSV (linha 1582) continua exportando a mesma string já formatada.

## Critério de aceite
- Contrato 2150 / ROYAL MAX (2026-06) passa a exibir duas linhas com rótulos distintos: `Diária — 15-20` e `Diária — 20-25`.
- Empresas Fechadas exibem `Fechada — 01-05` (ou o sub-período correspondente).
- Empresas com período específico de cobrança continuam mostrando o intervalo de 30 dias.
