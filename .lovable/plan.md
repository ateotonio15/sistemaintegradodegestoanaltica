## Funcionalidade: Gerar Histórico Automático

Adicionar geração automática do texto de histórico financeiro a partir da análise do Excel/PDF, mantendo o padrão textual atual da empresa.

### 1. UI — botão "Gerar Histórico"
Em `src/components/financeiro/AnaliseExcelRow.tsx`, ao lado do botão **Reanalisar** (mesmo canto superior direito), adicionar botão **Gerar Histórico** (variant outline, ícone `FileText`).
- Aparece apenas quando há `resultados` (análise concluída).
- Passar nova prop `onGerarHistorico?: () => void` recebendo a row.
- Propagar a prop em `FinanceiroTable.tsx` igual à `onReanalisar`, e expor no chamador (`Financeiro.tsx`).

### 2. Diálogo de Prorrogação (passo 1)
Novo componente `src/components/financeiro/GerarHistoricoDialog.tsx`. Ao clicar em "Gerar Histórico":
- Primeiro modal pergunta: **"O vencimento será prorrogado?"** com botões **Sim / Não**.
- Se **Não** → usa vencimento padrão (dia `empresas.data_vencimento_fatura` + mês/ano da competência).
- Se **Sim** → exibe os mesmos campos do `EditarMovimentacaoDialog` (Data da prorrogação, Motivo, Observação) e ao confirmar:
  - Faz `UPDATE` em `financeiro_movimentacoes` setando `possui_prorrogacao=true`, `data_prorrogacao`, `motivo_prorrogacao`, `observacao_prorrogacao`, `data_vencimento` (nova data).
  - Invalida queries para o `EditarMovimentacaoDialog` refletir automaticamente.

### 3. Geração do texto
Novo util `src/lib/historico-utils.ts` com função `gerarHistorico(row, resultados, opts)`:
- **Competência**: extrai do `mes_referencia` (preferido) ou do nome do arquivo Excel (regex `MES(ANO)`). Formato `Mês/AAAA` com mês em PT-BR capitalizado.
- **Linhas por categoria** (Enfermaria / Apartamento), no padrão `Enfermaria: {benef}x{mensalidade}= {total}` usando vírgula decimal e ponto de milhar (mesma formatação do `formatBRL` sem `R$`).
- **Inclusão**: só se `inclusoes.total > 0` → `Inclusão= {valor}`.
- **Exclusão**: só se `exclusoes.total != 0` → `Exclusão: ({valor positivo})`.
- **Data de Vencimento**: `DD/MM/AAAA` (prorrogada ou padrão).
- **Observações fixas** sempre incluídas:
  - "Dedução de base de cálculo conforme PARECER Nº02/2018 CJUR/PGM(Processo nº2018/2287/2908/00191 PGM)."
  - "Suspensão de PIS e COFINS, trânsito em julgado conforme Processo n° 0655998-44.2022.8.04.0001 TJAM"
- **Observação DDA**: incluir "OBS.: O boleto está disponível no sistema de DDA." **apenas** quando a movimentação estiver com nota emitida (`data_envio_nota` preenchida ou anexo PDF presente — mesma regra usada no `EditarMovimentacaoDialog`).

### 4. Preview / Edição / Ações
Após decidir prorrogação, abrir segundo modal com:
- `Textarea` editável contendo o texto gerado (preview).
- Botões: **Copiar histórico** (clipboard), **Salvar histórico** (persiste no banco), **Cancelar**.

### 5. Banco de dados
Nova tabela `public.historicos_financeiros`:
- `id uuid pk`
- `empresa_id uuid` (fk lógica)
- `financeiro_movimentacao_id uuid`
- `competencia text` (mes_referencia)
- `periodo text`
- `texto_historico text`
- `vencimento_utilizado date`
- `prorrogado boolean default false`
- `motivo_prorrogacao text`
- `usuario_geracao uuid`, `usuario_geracao_nome text`
- `data_geracao timestamptz default now()`
- `created_at`, `updated_at`
- Index único por `(financeiro_movimentacao_id)` — substituir ao regerar (upsert).
- RLS: leitura/escrita para `admin`, `financeiro`, `diretora`, `visualizacao` (consistente com `financeiro_movimentacoes`).

### 6. Integração com Editar Movimentação
- A prorrogação salva na etapa 2 já persiste em `financeiro_movimentacoes`; o `EditarMovimentacaoDialog` lê esses mesmos campos, então a sincronização é automática via React Query invalidation (`["financeiro-list"]`, etc.).
- Garantir que após salvar a prorrogação, as queries do dashboard/edição sejam invalidadas.

### Detalhes técnicos
- **Arquivos novos**: `src/components/financeiro/GerarHistoricoDialog.tsx`, `src/lib/historico-utils.ts`, migration SQL.
- **Arquivos editados**: `src/components/financeiro/AnaliseExcelRow.tsx` (botão + prop), `src/components/financeiro/FinanceiroTable.tsx` (prop pass-through), `src/pages/Financeiro.tsx` (estado do dialog + handlers), e import opcional no `EditarMovimentacaoDialog` se quisermos botão atalho (não obrigatório).
- **Formatação numérica**: reutilizar `formatBRL` de `excel-analysis-utils` removendo `R$` (ou criar `formatNumeroBR`).
- **Detecção de mês no nome do arquivo**: tabela `JANEIRO..DEZEMBRO` + fallback para `mes_referencia` da row.
