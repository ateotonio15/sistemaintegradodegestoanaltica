## Nova aba: Gestão de Vidas

Centro analítico unificado para acompanhar vidas ativas, entradas, saídas e crescimento de contratos — reutilizando 100% das regras já existentes (Relatório de Vidas, Movimentações, Implantações, Entradas/Saídas).

---

### 1. Rota e navegação

- Nova rota `/gestao-vidas` em `src/App.tsx`.
- Item de menu **"Gestão de Vidas"** em `AppLayout.tsx` (ícone `HeartPulse` ou `Activity`).
- Acesso por perfil:
  - **Diretora / Admin** → visão global
  - **Cadastro (comum)** → só contratos sob sua responsabilidade
  - **Administradoras** → só contratos vinculados
  - **Vendas** → só leitura (sem exportar)
- Bloqueado para Financeiro, Enfermeira, Visualização (a confirmar).

### 2. Estrutura da página (`src/pages/GestaoVidas.tsx`)

```text
┌─ Header + Filtros rápidos (Hoje | Mês | 3M | 6M | Ano)
├─ KPIs (6 cards)
│   Vidas Ativas · Entradas Mês · Saídas Mês · Saldo · Contratos · Administradoras
├─ Tabs: [Visão Geral] [Empresarial] [Administradoras] [Histórico] [Ranking]
│
│ Visão Geral:
│   - Gráfico Evolução Mensal (barras Entradas vs Saídas)
│   - Gráfico Linha: Vidas Ativas por Mês
│   - Top 10 contratos por vidas (barras horizontais)
│   - Card Crescimento (Entradas − Saídas) + variação %
│   - Alertas (redução > 10%, aumento > 20%, sem movimentação)
│
│ Empresarial / Administradoras:
│   - Cards resumo (contratos, vidas, entradas, saídas)
│   - Tabela detalhada por empresa/administradora
│
│ Histórico:
│   - Sub-tabs Entradas / Saídas
│   - Lista: Nome · CPF · Data · Empresa · Contrato · Tipo (Titular/Dep/Filho/Cônjuge)
│
│ Ranking:
│   - Maior Crescimento / Maior Redução
└─ Botões Exportar Excel · PDF
```

### 3. Filtros (sidebar/topo)

Mês, Ano, Empresa, Contrato, Administradora, Modalidade (Empresarial/Administradora), Status (Ativa/Suspensa/Rescindida).

### 4. Origem dos dados (sem nova lógica)

| Indicador | Fonte existente |
|---|---|
| Vidas ativas por empresa | `empresas.vidas` + `vidas_historico_administradoras.total_atual` |
| Entradas/Saídas mensais | `vidas_historico_administradoras` (já calculado por `entradas-saidas-analyzer.ts`) |
| Titulares/Dependentes/Filhos/Cônjuges | parser existente `layout-cpf-extractor.ts` (estender retorno se já tiver tipo; caso contrário mostrar apenas total) |
| Contratos e tipo | `empresas` (tipo_contrato, status_empresa, responsavel_user_id, executiva_user_id) |
| Alertas | calculado em memória a partir do histórico |

### 5. Performance

- Hook `useGestaoVidas(filters)` com React Query, cache 5min.
- Consulta agregada em `vidas_historico_administradoras` (já persiste por empresa/mês — sem reler XLSX).
- Botão **"Recalcular mês"** (somente Diretora/Admin) que chama `computeEntradasSaidas` existente.

### 6. Visual

Dark green enterprise (tokens já existentes em `index.css`), cards com `Card` do shadcn, gráficos via `recharts` (já no projeto), tabelas `DataTable`/shadcn `Table`. Estética Power BI: KPIs grandes no topo, grids 2-col, micro-sparklines nos cards.

### 7. Exportação

- Excel via `xlsx` (já instalado) — aba por seção.
- PDF via `jspdf` + `jspdf-autotable` (já instalado) — cabeçalho Samel, KPIs e tabelas.

### 8. Arquivos a criar

- `src/pages/GestaoVidas.tsx`
- `src/components/gestao-vidas/KpiHeader.tsx`
- `src/components/gestao-vidas/FiltrosGestaoVidas.tsx`
- `src/components/gestao-vidas/EvolucaoMensalChart.tsx`
- `src/components/gestao-vidas/VidasAtivasChart.tsx`
- `src/components/gestao-vidas/TopContratosChart.tsx`
- `src/components/gestao-vidas/TabelaEmpresas.tsx`
- `src/components/gestao-vidas/TabelaAdministradoras.tsx`
- `src/components/gestao-vidas/HistoricoEntradasSaidas.tsx`
- `src/components/gestao-vidas/RankingCrescimento.tsx`
- `src/components/gestao-vidas/AlertasVidas.tsx`
- `src/components/gestao-vidas/ExportarDialog.tsx`
- `src/hooks/useGestaoVidas.ts`
- `src/lib/gestao-vidas-utils.ts` (agregações + export Excel/PDF)

### 9. Arquivos a editar

- `src/App.tsx` → rota
- `src/components/AppLayout.tsx` → item de menu + gating por role
- `mem://index.md` + nova memória `mem://features/gestao-vidas`

### 10. Pontos a confirmar antes de implementar

1. **Histórico por pessoa (Titular/Dep/Filho/Cônjuge)**: hoje `layout-cpf-extractor` extrai apenas CPFs. Para mostrar nome + tipo precisamos estender o parser (ler colunas Nome e Tipo Dependência do layout). OK estender? Ou começamos só com contagens agregadas?
2. **Vendas**: realmente vê tudo somente-leitura, ou só contratos que ele criou?
3. **Recalcular pesado**: ok botão manual em vez de auto-recalcular ao abrir a aba?
