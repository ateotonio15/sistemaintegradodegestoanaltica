# 🚀 Plano — Implementação da aba Financeiro

## 🎯 Objetivo
Criar a página `/financeiro` exclusiva para **Admin**, com controle de envio de notas, anexos, cobranças, KPIs e gráficos — usando uma tabela separada (`financeiro_movimentacoes`) para não interferir nas movimentações operacionais existentes.

---

## 1. 🗄️ Banco de dados (migrações)

### Nova tabela `financeiro_movimentacoes`
Espelha o mês/período/empresa, mas focada no fluxo financeiro:
- `id` uuid PK
- `empresa_id` uuid (referência lógica a `empresas`)
- `mes_referencia` text (ex: `2026-04`)
- `periodo` text (`01-05`, `05-10`, …, `25-30`)
- `tipo_cobranca` text **(texto livre)** — campo aberto editável
- `data_envio_nota` date (nullable)
- `dentro_prazo` boolean default `true`
- `cobranca_registrada` boolean default `false`
- `responsavel` text
- `observacoes` text
- `created_at` / `updated_at` timestamptz
- **UNIQUE (`empresa_id`, `mes_referencia`, `periodo`)**

### Nova tabela `cobrancas`
- `id` uuid PK
- `financeiro_movimentacao_id` uuid
- `motivo` text not null
- `data` date not null
- `observacao` text
- `status` text default `aberta` — valores: `aberta` | `resolvida`
- `created_by` uuid
- `created_at` / `updated_at`

### Nova tabela `anexos_financeiro`
- `id` uuid PK
- `financeiro_movimentacao_id` uuid
- `nome_arquivo` text
- `storage_path` text
- `mime_type` text
- `tamanho_bytes` bigint
- `uploaded_by` uuid
- `created_at`

### RLS (todas as 3 tabelas)
- **SELECT** → `authenticated` (qualquer usuário logado pode ler)
- **INSERT / UPDATE / DELETE** → apenas `has_role(auth.uid(), 'admin')`

### Storage
- Bucket **privado** `anexos-financeiro`
- Path: `{empresa_id}/{financeiro_movimentacao_id}/{uuid}.{ext}`
- Policies:
  - SELECT (download via URL assinada): `authenticated`
  - INSERT/UPDATE/DELETE: somente admin

### Trigger
- `update_updated_at_column` em `financeiro_movimentacoes` e `cobrancas`

---

## 2. 🔐 Acesso e roteamento

- Adicionar rota `/financeiro` em `src/App.tsx` envolvida por novo guard `AdminOnlyRoute`:
  - não autenticado → `/auth`
  - autenticado mas não admin → `/`
- Adicionar item no menu lateral (`AppLayout.tsx`) com `adminOnly: true` e ícone `Wallet` ou `DollarSign` do lucide-react.

---

## 3. 🧱 Estrutura de arquivos

```
src/
├── pages/Financeiro.tsx
├── components/financeiro/
│   ├── KpiCards.tsx
│   ├── StatusChart.tsx
│   ├── PeriodSummary.tsx
│   ├── FinanceiroTable.tsx
│   ├── EditarMovimentacaoDialog.tsx
│   └── CobrancaDialog.tsx
└── lib/
    └── financeiro-utils.ts
```

> **Modo MOCK não será implementado** (decisão do usuário). Quando não houver dados, mostrar estado vazio elegante.

---

## 4. 🧠 Regras de negócio

### Status calculado (não persistido)
- `Enviada` → tem `data_envio_nota`
- `Fora do prazo` → `dentro_prazo === false` e sem nota
- `Aguardando nota` → existe envio do operacional (consultado via `movimentacoes.data_envio_financeiro`) mas sem `data_envio_nota`
- `Pendente` → nenhum envio ainda

Função `calcularStatusFinanceiro()` em `financeiro-utils.ts`.

### Períodos fixos
Reutilizar `PERIODOS` de `movimentacao-utils.ts`.

### Filtros (estado local na página)
- Busca (nome/CNPJ/contrato)
- Status calculado
- Tipo de cobrança
- Apenas fora do prazo (toggle)
- Período (vindo do `PeriodSummary`)
- Mês de referência (select padrão = mês atual)

### Regras de aplicação dos filtros
- **KpiCards** e **StatusChart** → aplicam SOMENTE filtro de período (e mês)
- **FinanceiroTable** → aplica TODOS os filtros
- **PeriodSummary** → SEMPRE baseado no total do mês (sem nenhum filtro), apenas conta por período

---

## 5. 📊 Componentes

### KpiCards (6 cards usando tokens HSL)
1. Total empresas (distintas no mês)
2. Notas enviadas (com `data_envio_nota`)
3. Aguardando nota
4. Pendentes
5. Fora do prazo (badge `destructive`)
6. Anexos (soma da contagem de `anexos_financeiro`)

### StatusChart (Recharts donut)
- Toggle com 3 modos: **Tipo de cobrança** | **Status** | **Prazo (dentro/fora)**
- Cores via tokens: `--primary`, `--success`, `--warning`, `--destructive`, `--info`, `--chart-4`, `--chart-5`
- Tooltip + legenda + estado vazio

### PeriodSummary
- 6 botões (`PERIODOS`) com contagem
- Clicar seleciona; clicar de novo limpa o filtro
- Botão ativo usa `bg-primary text-primary-foreground`

### FinanceiroTable
Colunas: Empresa · Contrato · CNPJ · Responsável · Tipo · Status · Data envio nota · Anexos · Ações
- Linha com `bg-destructive/5 border-l-2 border-destructive` quando fora do prazo
- Badge de cobrança ativa ao lado do nome (se houver `cobrancas` abertas)
- Contagem de anexos vinda da query `anexos-counts`
- Ações: Editar (✏️) e Cobrança (🔔)

### EditarMovimentacaoDialog
- Editar `tipo_cobranca` (input texto livre)
- Definir `data_envio_nota`
- Toggle `dentro_prazo`
- **Upload de anexos** (PDF, XLSX, XLS, CSV):
  1. `supabase.storage.from('anexos-financeiro').upload(path, file)`
  2. Inserir registro em `anexos_financeiro`
  3. Invalidar query `anexos-financeiro`
- Lista de anexos existentes com **download** (URL assinada) e **excluir** (storage + tabela)

### CobrancaDialog
- Campos: motivo (select com sugestões + outro), data, observação
- Ao salvar:
  - INSERT em `cobrancas` (status `aberta`)
  - UPDATE `financeiro_movimentacoes.cobranca_registrada = true`
  - Invalida queries

### Banner de cobranças abertas (no topo da página)
- `<Alert variant="warning">` quando há cobranças `aberta` no mês
- Mostra contagem e link para filtrar
- Toast disparado uma única vez por sessão (controle via `sessionStorage`)

---

## 6. 🔄 React Query

Queries:
- `["financeiro", mes]` → movimentações do mês com join lógico em `empresas`
- `["financeiro-anexos-counts", mes]` → `count` agrupado por `financeiro_movimentacao_id`
- `["cobrancas-abertas", mes]` → cobranças do mês
- `["financeiro-anexos", movId]` → lista de anexos do diálogo aberto

Mutations invalidam as queries relacionadas automaticamente.

---

## 7. 🎨 Design (apenas tokens HSL)

Usar **exclusivamente** classes baseadas nos tokens já definidos em `src/index.css`:
- `bg-card` / `text-card-foreground`
- `text-muted-foreground` / `border-border`
- `bg-primary` / `bg-success` / `bg-warning` / `bg-destructive` / `bg-info`
- `text-primary` / `text-success` / `text-warning` / `text-destructive` / `text-info`

❌ Proibido: `text-red-500`, `bg-blue-200`, etc.

Cards arredondados (`rounded-xl`), sombras suaves (`shadow-sm`), espaçamento consistente com o restante do app.

---

## 8. ✅ Entregáveis

- 1 migração SQL (3 tabelas + RLS + bucket + storage policies)
- 1 página + 6 componentes + 1 utilitário
- Atualização do menu (`AppLayout.tsx`)
- Atualização das rotas (`App.tsx`) com `AdminOnlyRoute`
- Tipagem TypeScript completa (vai aproveitar `Database` regenerado)

Após a aprovação, posso começar pela migração SQL e seguir construindo os componentes em ordem (utils → página esqueleto → KpiCards → PeriodSummary → StatusChart → tabela → diálogos).