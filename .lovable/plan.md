# Prompt: Registro de Reclamações (Módulo Demandas)

Use este prompt para recriar ou evoluir o módulo de **Registro de Reclamações** dentro do SIGA.

---

## 1. Identidade do módulo

- **Nome:** Registro de Reclamações
- **Slug interno:** `demandas`
- **Rota principal:** `/demandas`
- **Sub-rotas:**
  - `/demandas/nova` — criar nova demanda (abre `DemandaFormDialog` em tela cheia)
  - `/demandas/dashboard` — dashboard analítico de SLA e volume
  - `/demandas/fora-do-prazo` — lista filtrada de reclamações fora do SLA
  - `/demandas/apresentacao` — modo apresentação dos indicadores
- **Propósito:** abertura, acompanhamento e resolução de demandas/reclamações de beneficiários e empresas clientes, com controle de SLA por setor.

---

## 2. Stack e padrões do projeto

- **Frontend:** React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui, React Query (TanStack Query), React Router DOM, date-fns, Recharts, XLSX (SheetJS), jsPDF, lucide-react, sonner/toast.
- **Backend:** Supabase (PostgreSQL + PostgREST + Row Level Security + Realtime onde aplicável).
- **Autenticação/Autorização:** papéis via `user_roles` (`admin`, `financeiro`, `comum`, `diretora`, `executivo`, `executivo_externo`, `visualizacao`, `enfermeira`, `tec_enfermagem`, `coordenadora`, `administradoras`, `vendas`). O `display_name` do perfil logado é usado como "Executiva(o) responsável".
- **Padrão visual SIGA:** tema dark-mode default, verde primário, superfícies glass/card, tipografia Inter, badges semânticas, ícones Lucide.

---

## 3. Schema do banco de dados

### Tabela `public.demandas`

| Coluna | Tipo | Obrigatório | Default | Observação |
|--------|------|-------------|---------|------------|
| `id` | uuid | sim | gen_random_uuid() | PK |
| `data_reclamacao` | date | sim | — | data de abertura |
| `nome_cliente` | text | sim | — | beneficiário |
| `empresa` | text | não | — | nome da empresa |
| `setor_responsavel` | text | não | — | setor destino |
| `tipo_reclamacao` | text | não | — | classificação do tipo |
| `reclamacao` | text | não | — | item específico |
| `detalhamento` | text | não | — | descrição longa |
| `observacao` | text | não | — | campo livre |
| `executiva` | text | não | — | nome da executiva(o) |
| `cpf` | text | não | — | somente obrigatório para cirúrgicas |
| `data_entrada` | date | não | — | somente cirúrgicas |
| `nome_medico` | text | não | — | somente cirúrgicas |
| `nome_procedimento` | text | não | — | somente cirúrgicas |
| `encaminhado_setor` | boolean | sim | false | já encaminhado? |
| `resolvido_setor` | boolean | sim | false | setor resolveu? |
| `data_resolucao_setor` | date | não | — | data da resolução do setor |
| `resolvido_executiva` | boolean | sim | false | executiva fechou? |
| `data_resolucao_executiva` | date | não | — | data do fechamento |
| `importacao_id` | uuid | não | — | FK lógica para `importacoes` |
| `created_by` | uuid | não | — | usuário que criou |
| `created_at` | timestamptz | sim | now() | — |
| `updated_at` | timestamptz | sim | now() | — |

### Tabela `public.importacoes`

| Coluna | Tipo | Obrigatório | Default | Observação |
|--------|------|-------------|---------|------------|
| `id` | uuid | sim | gen_random_uuid() | PK |
| `nome_arquivo` | text | sim | — | nome do arquivo importado |
| `total_registros` | integer | sim | 0 | quantidade de linhas |
| `importado_por` | uuid | não | — | usuário |
| `importado_por_nome` | text | não | — | nome exibido |
| `created_at` | timestamptz | sim | now() | — |

### Regras de negócio (status e SLA)

```text
Status:
- resolvido_executiva = true  -> "Finalizada"
- resolvido_setor = true      -> "Resolvida"
- nenhum dos dois             -> "Pendente"

SLA:
- Padrão: 72h úteis
- Agenda Cirúrgica: 168h úteis
- Crítica: > 15 dias corridos em aberto

Cálculo de "dias em aberto":
- Aberto: hoje - data_reclamacao
- Fechado: data_resolucao - data_reclamacao

Campos cirúrgicos obrigatórios quando a reclamação for:
- "Aprazamento cirúrgico"
- "Cancelamento cirúrgico"
  -> exigir CPF, data_entrada, nome_medico, nome_procedimento
```

---

## 4. Constantes de classificação (cascata)

### Setores disponíveis

```ts
export const SETORES = [
  "Agenda Cirúrgica",
  "Atendimento",
  "Auditoria",
  "Cadastro",
  "Clínica Externa",
  "Direção Clínica",
  "Financeiro",
  "Laboratório",
  "Oncologia",
  "Serviço Social",
  "T.I",
];
```

### Tipos de reclamação

```ts
export const TIPOS = [
  "Aplicativo Samel",
  "Aprazamento",
  "Cancelamento",
  "Assistencial",
  "Conduta Médica",
  "Falha Cadastral",
  "Nota Fiscal",
  "Portal",
  "Reclamação",
  "T.I",
];
```

### Reclamações (cascata setor → tipo → reclamação)

- **RECLAMACOES_POR_SETOR_TIPO** — mapeamento mais específico.
- **RECLAMACOES_POR_TIPO** — fallback por tipo.
- **RECLAMACOES** — lista geral (fallback final).

Exemplos:
- `Agenda Cirúrgica + Aprazamento` → `"Aprazamento cirúrgico"`
- `Agenda Cirúrgica + Cancelamento` → `"Cancelamento cirúrgico"`
- `Financeiro + Nota Fiscal` → `"Atraso na emissão da nota"`
- `Atendimento + Aprazamento` → consultas/exames/terapias

Função `getReclamacoesDisponiveis(setor, tipo)` resolve na ordem: específico → tipo → geral.
Função `normalizarReclamacao(v)` garante valor canônico.

---

## 5. Arquitetura de telas e componentes

### Páginas

| Página | Arquivo | Responsabilidade |
|--------|---------|------------------|
| Lista de reclamações | `src/pages/Demandas.tsx` | Tabela com filtros, ações, exportação Excel |
| Nova demanda | `src/pages/NovaDemanda.tsx` | Wrapper que abre o form em modo criação |
| Dashboard | `src/pages/DemandasDashboard.tsx` | KPIs, gráficos de evolução, ranking, matriz de risco |
| Fora do prazo | `src/pages/DemandasForaDoPrazo.tsx` | Lista focada em demandas vencidas |
| Apresentação | `src/pages/ApresentacaoIndicadores.tsx` | Modo fullscreen para TVs/reuniões |

### Componentes principais

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| `DemandaFormDialog` | `src/components/demandas/DemandaFormDialog.tsx` | Formulário de criação/edição com cascata setor→tipo→reclamação, autocomplete de beneficiário, validação de campos cirúrgicos |
| `ImportarDemandasDialog` | `src/components/demandas/ImportarDemandasDialog.tsx` | Upload XLSX/CSV, mapeamento flexível de colunas, importação em lotes de 200 |
| `HistoricoImportacoesDialog` | `src/components/demandas/HistoricoImportacoesDialog.tsx` | Lista de lotes importados com opção de exclusão (cascade nas demandas) |
| `PessoaFisicaAutocomplete` | `src/components/demandas/PessoaFisicaAutocomplete.tsx` | Busca de beneficiários por nome |

### Hooks

| Hook | Arquivo | Responsabilidade |
|------|---------|------------------|
| `useDemandas` | `src/hooks/useDemandas.ts` | Lista com RLS; executivo_externo só vê próprios |
| `useCreateDemanda` | `src/hooks/useDemandas.ts` | Insert em `demandas` |
| `useUpdateDemanda` | `src/hooks/useDemandas.ts` | Update |
| `useDeleteDemanda` | `src/hooks/useDemandas.ts` | Delete |
| `useImportacoes` | `src/hooks/useDemandas.ts` | Lista de importações |
| `useDeleteImportacao` | `src/hooks/useDemandas.ts` | Remove lote (cascade) |
| `useImportDemandasLote` | `src/hooks/useDemandas.ts` | Insere lote + demandas em chunks |

### Lib utilitária

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/demandas-utils.ts` | Tipos, status, SLA, dias aberto, parse de datas local (evita UTC bug), emptyToNull |
| `src/lib/constants.ts` | SETORES, TIPOS, RECLAMACOES, funções de cascata |
| `src/lib/beneficiario-lookup.ts` | Busca automática por CPF (API Samel) |
| `src/lib/pessoa-fisica-lookup.ts` | Autocomplete de pessoa física |
| `src/lib/demandas-dashboard-pptx.ts` | Exportação do dashboard para PPTX |

---

## 6. Permissões e gates

```text
/demandas
- Admin: tudo (criar, editar, excluir, importar, exportar, dashboard)
- Executivo / Executivo externo: pode criar e editar
- Executivo externo: visualiza apenas demandas que ele mesmo criou (created_by)
- Diretora / Visualização: somente leitura
- Financeiro/Comum/Adminsitradoras: acesso à lista conforme RLS geral

Regra de edição por linha (frontend):
- Admin pode editar qualquer demanda
- Diretora e Visualização não editam
- Executivo/Executivo externo pode editar
- Usuários comuns só editam demandas onde executiva == display_name do perfil logado
```

---

## 7. Funcionalidades obrigatórias

1. **Cascata de classificação**: setor responsável → tipo de reclamação → reclamação. Ao trocar setor ou tipo, limpar os campos dependentes.
2. **Validação de campos cirúrgicos**: quando a reclamação for cirúrgica, exigir CPF, data de entrada, médico e procedimento.
3. **Busca automática de beneficiário**: ao digitar CPF com 11 dígitos, consultar API e preencher nome/empresa.
4. **Autocomplete de beneficiário**: buscar por nome e preencher CPF.
5. **Status automático**: derivado das flags `resolvido_setor` e `resolvido_executiva`.
6. **SLA**: cálculo em horas úteis; badge/cor diferenciada para fora do prazo e crítica.
7. **Filtros na lista**: data inicial/final, empresa, setor, executiva(o), status, busca por beneficiário.
8. **Exportação Excel**: todos os campos visíveis + status + dias em aberto.
9. **Importação em lote**: XLSX/CSV com mapeamento flexível de cabeçalhos; lotes de 200; rollback do lote em caso de erro.
10. **Histórico de importações**: listar lotes e permitir exclusão (cascade remove demandas vinculadas).
11. **Dashboard analítico**:
    - Total, resolvidas, em aberto, fora do prazo, % SLA
    - Evolução mensal (últimos 6–8 meses)
    - Tempo médio de resolução
    - Volume por setor e por tipo
    - Matriz de risco (volume × % fora do prazo)
    - Ranking empresas: reclamações × vidas ativas
    - Resolução por origem (Executiva vs Setor)
    - Exportação para PPTX
12. **Integração com plantões**: ao criar uma demanda vinda de `/plantoes/:id/atendimentos`, salvar também um registro em `plantoes_atendimentos` vinculando a demanda ao plantão.
13. **Drilldown por URL**: `?id=<uuid>` na lista abre o formulário de edição automaticamente.

---

## 8. Regras de validação do formulário

- `data_reclamacao` obrigatória
- `nome_cliente` obrigatório
- `setor_responsavel` obrigatório
- `tipo_reclamacao` obrigatório
- `reclamacao` obrigatória
- `empresa` obrigatória
- Se reclamação cirúrgica: `cpf`, `data_entrada`, `nome_medico`, `nome_procedimento` obrigatórios
- Se `resolvido_setor` = true, `data_resolucao_setor` obrigatória
- Se `resolvido_executiva` = true, `data_resolucao_executiva` obrigatória
- Ao desmarcar `resolvido_setor`, limpar data e também desmarcar `resolvido_executiva`

---

## 9. Dicas de prompts para evolução

- "Adicione um campo de prioridade (Alta/Média/Baixa) ao formulário de demandas e uma coluna na lista."
- "Crie notificações em tempo real quando uma demanda ultrapassar o SLA."
- "Adicione um kanban de status (Pendente / Resolvida / Finalizada) na tela /demandas."
- "Permita anexar arquivos à demanda (implantação/anexos)."
- "Gera um relatório de produtividade por executiva filtrado por período."

---

## 10. Observações técnicas

- Sempre use construção manual de `Date` local (`new Date(ano, mes, dia)`) para evitar bugs de UTC/fuso nas datas brasileiras.
- Normalização de string: `NFD` + regex de diacríticos antes de comparar.
- Use `emptyToNull` antes de inserir/atualizar no Supabase para evitar strings vazias.
- RLS: a tabela `demandas` deve ter políticas que permitam leitura conforme papel e, para executivo_externo, filtrar por `created_by`.
- Cache do React Query: `staleTime: 2min`, invalidar query key `["demandas"]` após mutations.
