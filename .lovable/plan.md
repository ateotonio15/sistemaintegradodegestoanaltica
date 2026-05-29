# Análise por Competência — Histórico de Análises

## Objetivo

Adicionar no diálogo "Histórico de Análises" uma área "Análise por Competência" que, ao escolher Competência + Período, percorre todos os contratos/pagadores daquele período, executa a análise (Excel × PDF) de cada um reaproveitando o pipeline existente, salva os resultados como novos registros de execução em lote e exibe cards de resumo, tabela detalhada, modal de detalhamento e exportação Excel.

A análise individual existente, anexos, KPIs, status financeiro, geração de histórico e tela do Financeiro permanecem **inalterados**.

## Escopo da UI (Histórico de Análises)

Topo do diálogo (acima da busca atual):

```text
┌─ Análise por Competência ─────────────────────────────────────┐
│ Selecione a competência e o período para analisar todos os    │
│ contratos vinculados e identificar divergências, pendências   │
│ documentais ou erros de leitura.                              │
│                                                                │
│ [Competência ▼ Mai/2026]  [Período ▼ 05-10]  [Analisar]       │
│ [Histórico de execuções ▼]                  [Exportar Excel]  │
└────────────────────────────────────────────────────────────────┘

┌─ Resumo da execução ──────────────────────────────────────────┐
│ [Total] [OK] [Divergentes] [Sem Excel] [Sem PDF] [S/Ambos]    │
│ [Erro leitura] [Aguardando fat.] [Sem movim.]                  │
│ % OK · % Pendência · Valor analisado · Valor divergente        │
└────────────────────────────────────────────────────────────────┘

┌─ Resultados (tabela) ─────────────────────────────────────────┐
│ Empresa · CNPJ · Contrato · Pagador · Comp. · Período ·       │
│ Status · Excel? · PDF? · Excel×PDF · Valor Excel · Valor NF · │
│ Diferença · Divergências · Erros · Próxima ação · Data · User │
│  → clique em linha abre Painel de Detalhamento                 │
└────────────────────────────────────────────────────────────────┘
```

A aba "Histórico do mês" atual (tabela existente) é preservada como uma sub-aba ao lado de "Análise por Competência".

## Status e regras

| Situação | Status | Próxima ação |
|---|---|---|
| Excel + PDF, valores batem | OK | Nenhuma ação necessária |
| Excel + PDF, divergem | Divergente | Verificar divergência entre Excel e nota fiscal |
| Só Excel | Sem PDF | Anexar PDF da nota fiscal |
| Só PDF | Sem Excel | Anexar Excel/relatório de faturamento |
| Nenhum | Sem Excel e sem PDF | Anexar documentos obrigatórios |
| Falha no parser Excel | Erro ao ler Excel | Verificar formato/conteúdo do Excel |
| Falha no parser PDF | Erro ao ler PDF | Verificar formato/conteúdo do PDF |
| Contrato ativo no período sem movimentação criada | Contrato sem movimentação | Verificar se deveria ser faturado |
| Movimentação no período ainda não faturada | Aguardando faturamento | Iniciar faturamento |

## Detalhes técnicos

### 1. Novas tabelas (migração)

`financeiro_analise_execucoes` (cabeçalho da execução em lote)
- mes_referencia, periodo, executado_por, executado_por_nome, iniciada_em, finalizada_em
- totais: total, ok, divergentes, sem_excel, sem_pdf, sem_ambos, erro_leitura, aguardando_faturamento, sem_movimentacao
- valor_total_analisado, valor_total_divergente
- status (em_andamento | concluida | falhou)

`financeiro_analise_execucao_itens` (1 linha por contrato/pagador analisado)
- execucao_id (FK), empresa_id, financeiro_movimentacao_id (nullable), pagador_id, pagador_nome, pagador_cnpj
- status (enum dos status acima), excel_encontrado (bool), pdf_encontrado (bool), comparado (bool)
- valor_excel, valor_pdf, diferenca
- divergencias (jsonb), erros (jsonb), proxima_acao (text)
- resultado_completo (jsonb — mesma forma do `resultado_completo` em `financeiro_analises`)
- nome_arquivo_excel, nome_arquivo_pdf, hash_excel, hash_pdf

GRANTs + RLS:
- SELECT para `authenticated` (financeiro, admin, comum, viewonly podem consultar)
- INSERT/UPDATE para `financeiro` e `admin`
- DELETE somente `admin`
- Policies usam `has_role`.

### 2. Backend / lógica (frontend, reaproveitando libs existentes)

Novo arquivo `src/lib/financeiro-analise-lote.ts`:
- `listarContratosDoPeriodo(mes, periodo)` → busca `financeiro_movimentacoes` do mês cujo `periodo` bate; cruza com `empresas` ativas que pertencem àquele período (mesma regra usada hoje em `periodoDaDataCorte`) para detectar **Aguardando faturamento** (empresa do período sem movimentação criada) e **Sem movimentação** (movimentação existe mas sem anexos nem valores).
- `analisarContratoLote(item)` para cada item:
  1. Busca anexo Excel (`anexos_financeiro` tipo xlsx) e PDF (tipo pdf) — mesma origem usada hoje no `Financeiro.tsx`.
  2. Se faltar Excel/PDF → status "Sem Excel"/"Sem PDF"/"Sem ambos".
  3. Se houver Excel: tenta parsear com `analisarExcelFinanceiroPorCnpj` (ou `analisarExcelMotoHonda` quando `tipo_analise = moto_honda`); try/catch → "Erro ao ler Excel".
  4. Se houver PDF: parser PDF existente; try/catch → "Erro ao ler PDF".
  5. Se ambos OK: monta comparação (reaproveita helper existente) → divergências via `extrairDivergencias`. Sem divergência → "OK"; com divergência → "Divergente".
  6. Calcula `proxima_acao` pela tabela acima.
  7. Erros não interrompem o lote — capturados por contrato.
- `executarAnaliseCompetencia(mes, periodo, onProgress)`:
  - Cria registro em `financeiro_analise_execucoes` (status em_andamento).
  - Itera em série (com `onProgress(i, total)`), grava cada item, atualiza contadores no cabeçalho ao final, marca `concluida`.

### 3. Componentes novos

- `src/components/financeiro/AnaliseCompetenciaPanel.tsx` — filtros, botão Analisar, barra de progresso, cards de resumo, tabela, botão exportar, picker do histórico de execuções.
- `src/components/financeiro/AnaliseCompetenciaItemDialog.tsx` — modal de detalhamento de um item (dados empresa/contrato, arquivos usados, valores, campos comparados/divergentes, erros, usuário, data, próxima ação).
- `src/components/financeiro/HistoricoAnalisesDialog.tsx` — adicionar `Tabs`:
  - Aba 1 "Histórico do mês" (conteúdo atual, sem alterações).
  - Aba 2 "Análise por Competência" (novo painel).

### 4. Exportação

`exportarExecucaoExcel(execucaoId)` em `financeiro-analise-lote.ts` usando `exceljs` (já no projeto): gera planilha única com todas as colunas listadas no requisito.

### 5. Permissões

- Executar análise + exportar: `isAdmin || isFinanceiro`.
- Visualizar e exportar resultados: também `isComum` e `isViewOnly`.
- Excluir execuções antigas: apenas `isAdmin` (botão lixeira ao lado da execução no picker).
- Gates feitos via `useAuth` + RLS no DB.

### 6. Histórico de execuções

- Picker "Histórico de execuções" lista as últimas N execuções (mes/periodo/usuário/data/totais).
- Selecionar uma execução antiga recarrega cards + tabela a partir de `financeiro_analise_execucao_itens` (sem reexecutar).
- Cada clique em "Analisar competência" **cria nova execução** (nunca sobrescreve). Permite comparar execuções para a mesma competência/período.

## Garantias de não-regressão

- Nenhuma alteração em: `Financeiro.tsx` (exceto eventualmente passar `canManage` extra para o diálogo), `FinanceiroTable`, fluxo de análise individual, anexos, `salvarAnalise`/`financeiro_analises`, KPIs, geração de histórico, exportação atual, status financeiro, movimentações.
- A análise em lote consome as mesmas funções utilitárias de parsing/comparação já usadas pela análise individual — sem fork de lógica.
- Tabelas novas isoladas; nenhuma policy/grant existente é modificada.

## Entregáveis

1. Migração SQL (2 tabelas + grants + RLS + policies).
2. `src/lib/financeiro-analise-lote.ts`.
3. `src/components/financeiro/AnaliseCompetenciaPanel.tsx`.
4. `src/components/financeiro/AnaliseCompetenciaItemDialog.tsx`.
5. Atualização de `HistoricoAnalisesDialog.tsx` com Tabs.
