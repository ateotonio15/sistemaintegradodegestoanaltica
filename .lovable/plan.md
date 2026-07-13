## Dashboard Executivo — Saúde Ocupacional

Nova página `/saude-empresas/dashboard-executivo` (link no menu do módulo Saúde nas Empresas). Não substitui o módulo existente — adiciona uma camada executiva para diretoria, com dados reais consolidados quando disponíveis e fallback para os números de Julho/2026 fornecidos.

### 1. Layout (estilo consultoria)

- Paleta: Teal profundo `#004d40`, verde hospitalar `#1b998b`, slate `#0f172a` / `#f8fafc`. Tokens novos no `index.css` (semânticos: `--exec-primary`, `--exec-accent`, `--exec-surface`, gradientes e sombras premium).
- Tipografia display para títulos (fonte serif condensada tipo "Instrument Serif" para números-chave; Inter para corpo).
- Header fixo com: título, seletor Mês/Ano (default Julho 2026), botão "Simular mês" (força Out/Nov), botão "Exportar PDF", botão "Modo Apresentação".

### 2. KPIs + Filtros

- 6 KPI cards animados (fade + count-up): Total Ações, Empresas Atendidas, Palestras, Sinais Vitais, PSA, Coletas Preventivas + linha Média Semanal e Campanhas Ativas.
- Filtros: Empresa (multi), Tipo de Ação, Executiva Responsável.

### 3. Gráficos (Recharts)

- Barras horizontais: distribuição por campanha (Sinais Vitais 16, Hepatites Virais 12, Palestras Gerais 2 — usa dados reais quando existirem, senão fallback Jul/26).
- Donut de engajamento Sinais Vitais vs Palestras (53.3% / 46.7%).
- Ranking Top Empresas Atendidas (Nippon Seiki, Klabin, Elgin, PST, TPV, Winlogis).

### 4. Sinais Vitais & Triagem

- Painel com PA/Glicemia agregando por empresa (reusa `triagens` existentes).
- Gráfico radar de alterações clínicas por empresa (PA alta, glicemia alta, IMC, tabagismo).
- Tabela com busca global (Elgin, PST, TPV…).

### 5. Módulos condicionais

- Hook `useCampanhaMes(mes, forcedMes?)`:
  - `mes === 10` → renderiza módulo **Outubro Rosa** (mamografias agendadas/realizadas, engajamento feminino, laço rosa SVG grande em card hero).
  - `mes === 11` → renderiza módulo **Novembro Azul** (PSA realizados, triagem masculina, adesão operária).
  - Outros meses → nada.
- Botão "Simular mês" abre popover com Outubro/Novembro/Reset → seta `forcedMes` local (não altera dados, só a visualização das abas).

### 6. Exportação e Apresentação

- **PDF Executivo**: usa `jspdf` + `html2canvas` (já instalados no projeto) para snapshotar cada seção como slide A4 paisagem estilo BCG (capa teal com título + KPIs, seção gráficos, seção triagem, apêndice).
- **Modo Apresentação**: rota interna com estado (não fullscreen route separada) que:
  - Entra em `document.documentElement.requestFullscreen()`.
  - Renderiza slides sequenciais (Capa → KPIs → Distribuição → Engajamento → Top Empresas → Triagem → [Módulo condicional] → Encerramento).
  - Navegação por ←/→/Space, indicador de progresso, contador N/Total, sair com Esc.

### Detalhes técnicos

```
src/modules/saude-empresas/
  pages/DashboardExecutivo.tsx          # página principal
  components/executive/
    ExecHeader.tsx                       # seletor mês + botões
    KpiGrid.tsx                          # 6 cards animados
    CampanhaBarChart.tsx
    EngajamentoDonut.tsx
    TopEmpresasChart.tsx
    TriagemPanel.tsx
    OutubroRosaModule.tsx
    NovembroAzulModule.tsx
    SimuladorMesButton.tsx
    ApresentacaoOverlay.tsx              # fullscreen slides
  hooks/useDashboardExecutivo.ts         # fetch + fallback Jul/26
  lib/exec-export-pdf.ts                 # jspdf/html2canvas
  lib/exec-mock-julho-2026.ts            # dados fallback
```

- Rota adicionada em `src/App.tsx`, link no menu do módulo Saúde.
- Query padrão puxa de `acoes_saude`, `palestras_saude`, `acoes_preventivas`, `triagens` filtrando por mês/ano; se retorno < esperado para Jul/26, mescla com mock consolidado.
- Nenhuma alteração em schema/migrations.

### Fora de escopo

- Não altera o fluxo existente de agendamento/calendário/relatório mensal PPTX (já implementado). Este dashboard é uma camada de leitura executiva.
