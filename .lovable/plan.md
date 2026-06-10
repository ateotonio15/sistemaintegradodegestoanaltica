## Dashboard Executivo de Reclamações

Nova rota `/demandas/dashboard` voltada para leitura em sala/TV (tipografia grande, alto contraste, responsivo widescreen). Lê direto da tabela `demandas` já existente, sem novas tabelas.

### Acesso
- Apenas Admin (mesma regra do módulo Demandas).
- Botão "Dashboard" no topo da página `/demandas` levando para `/demandas/dashboard`, e link de volta.

### Filtros (barra superior, persistidos em Context)
- Período (data inicial / final, padrão últimos 30 dias)
- Empresa, Setor, Executiva (multi-select)
- Aplicam-se a todos os cards.

### Cards / Componentes

1. **KPIs (4 cartões grandes)**
   - SLA Geral: % de demandas com `data_resolucao` dentro de 5 dias úteis da `data_reclamacao`.
   - Backlog Crítico: nº em aberto há mais de 5 dias.
   - Tempo Médio de Resposta: média de dias entre `data_reclamacao` e `data_resolucao` (resolvidas no período).
   - Score Operacional (0–100): `0.5 * SLA + 0.3 * (1 - backlog_critico/total) + 0.2 * (1 - tempo_medio/10)` (clamp 0–100).

2. **TrendLineCard** — recharts LineChart com SLA% e Backlog por semana no período.

3. **MatrizRiscoSetores** — heatmap setor × tipo de reclamação. Cor por volume, anotação com atraso médio (dias).

4. **VolumeReclamacoesSetor** — barras horizontais por setor, %Δ vs período anterior de mesmo tamanho, thresholds: verde ≤0%, amarelo ≤20%, vermelho >20%.

5. **ReincidênciasSetores** — tabela por setor: Total, Reincidentes (mesmo `nome_cliente` com 2+ no período), Taxa%, Tendência (↑↓ vs período anterior), Status (badge).

6. **GargalosPanel** — top 5 `tipo_reclamacao` por volume com tempo médio.

7. **AlertasCríticos** — lista de demandas em aberto > 5 dias, click leva para `/demandas?reclamacao=<id>` (abre o registro no formulário existente).

8. **InsightsBanner** — frase automática no topo: ex. "Setor Atendimento subiu 32% esta semana" baseada na maior variação positiva.

### Implementação técnica

```text
src/
  pages/
    DemandasDashboard.tsx           // página /demandas/dashboard
  components/demandas/dashboard/
    DashboardFiltersBar.tsx
    KpiExecCard.tsx
    TrendLineCard.tsx
    MatrizRiscoSetores.tsx
    VolumeReclamacoesSetor.tsx
    ReincidenciasSetores.tsx
    GargalosPanel.tsx
    AlertasCriticos.tsx
    InsightsBanner.tsx
  hooks/
    useDemandasDashboard.ts         // fetch único + agregações via useMemo
  contexts/
    DemandasDashboardFiltersContext.tsx
```

- Reutiliza `useDemandas` para fetch base ou cria query dedicada `select('id, data_reclamacao, data_resolucao, empresa, setor, executiva, tipo_reclamacao, nome_cliente, status')` filtrada por intervalo de datas.
- Agregações 100% no client com `useMemo` (volume controlável; dataset esperado pequeno-médio).
- Usa `recharts` (já no projeto) e tokens semânticos do `index.css` — nada hardcoded.
- Rota adicionada em `src/App.tsx` dentro do `AppLayout`, link novo em `AppSidebar` ou apenas dentro de `/demandas`.
- Drilldown: `AlertasCríticos` navega para `/demandas?reclamacao=<id>`; ajustar `Demandas.tsx` para abrir `DemandaFormDialog` quando o query param `reclamacao` estiver presente.

### Fora de escopo deste plano
- Tabelas novas, edge functions, importações.
- Outras abas (Plantões, Uber, Avaliações, Cestas) — serão planejadas separadamente quando você pedir.

Confirma para eu implementar?