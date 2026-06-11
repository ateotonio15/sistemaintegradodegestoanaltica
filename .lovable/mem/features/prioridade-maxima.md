---
name: Prioridade Máxima
description: Funcionalidade para marcar empresas como Prioridade Máxima, com histórico imutável, alertas pulsantes até envio ao Financeiro e badge em todas as telas.
type: feature
---
- Tabela `empresa_prioridade_maxima` mantém histórico imutável (NUNCA apagar); empresas têm `prioridade_maxima_id` apontando para a marcação ativa.
- RPCs: `marcar_prioridade_maxima(empresa_id, motivo, observacoes)` e `remover_prioridade_maxima(empresa_id, motivo_remocao)`. Permissão: apenas Admin e Diretora.
- Componentes em `src/components/prioridade/`: PrioridadeBadge (variants default/pulsing/compact/fire), PrioridadeDialog, PrioridadeInfoCard, PrioridadeHistoricoDialog.
- Hook `usePrioridadeMaxima` expõe `canManage` (admin || diretora) + mutations marcar/remover.
- Alerta visual pulsante (classe `.priority-row` + `animate-pulse-priority`) só desaparece quando contrato é enviado ao Financeiro (`movimentacoes.data_envio_financeiro` preenchido).
- Empresas marcadas ficam no topo das listas (Dashboard, Empresas) por ordenação `prioridade_maxima_id IS NOT NULL` primeiro.
- Dashboard tem card dedicado `PrioridadeMaximaDashboardCard` no topo. Financeiro mostra badge `🔥 PRIORIDADE`.
