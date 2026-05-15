# Persistência das Análises Excel × PDF (Financeiro)

## Objetivo
Salvar no banco o resultado das análises Excel × PDF feitas na aba Financeiro para que sobrevivam a reload, navegação e logout, evitando reprocessamento. Adicionar histórico, "Reanalisar" e fazer "Exportar Erros" usar somente análises persistidas.

## 1. Banco — nova tabela `financeiro_analises`

Migration cria:

- `id uuid pk`
- `empresa_id uuid not null` (sem FK para manter padrão do projeto)
- `financeiro_movimentacao_id uuid` (link opcional para a linha do Financeiro)
- `mes_referencia text not null` (ex.: "2026-05") — equivale a "competência"
- `periodo text not null` (ex.: "01-31", "20-25", etc.)
- `pagador_nome text` / `pagador_cnpj text` (análise é por pagador; uma linha do Financeiro pode ter N pagadores → N análises)
- `tipo_analise text` — espelha `financeiro_movimentacoes.tipo_analise`
- `status_analise text not null check in ('OK','ERRO','PENDENTE')`
- `nome_arquivo_excel text`, `nome_arquivo_pdf text`
- `hash_excel text`, `hash_pdf text` (sha-256 hex)
- Valores consolidados (numeric):
  `valor_excel_apartamento`, `valor_pdf_apartamento`,
  `valor_excel_enfermaria`, `valor_pdf_enfermaria`,
  `valor_excel_inclusoes`, `valor_pdf_inclusoes`,
  `valor_excel_exclusoes`, `valor_pdf_exclusoes`,
  `qtd_excel_apartamento int`, `qtd_pdf_apartamento int`,
  `qtd_excel_enfermaria int`, `qtd_pdf_enfermaria int`
- `divergencias jsonb` — array estruturado `[{campo, valor_excel, valor_pdf, diferenca, mensagem}]`
- `resultado_completo jsonb` — payload completo de `ComparacaoResultado`/`ComparacaoSimplificada` + `AnaliseResultado` para "Ver detalhes" sem reprocessar
- `mensagem_final text`
- `analisado_por uuid`, `analisado_por_nome text`
- `data_analise timestamptz default now()`
- `created_at`, `updated_at` + trigger `update_updated_at_column`

Índices:
- `(empresa_id, mes_referencia, periodo, pagador_cnpj)` — lookup rápido
- `(empresa_id, mes_referencia, periodo, hash_excel, hash_pdf)` — verificação de cache

RLS:
- Admin: ALL
- Financeiro: ALL
- Authenticated: SELECT

## 2. Lógica de cache (frontend)

`src/lib/financeiro-analise-cache.ts` (novo):
- `sha256Hex(buffer)` usando `crypto.subtle.digest`.
- `buscarAnaliseSalva({ empresa_id, mes_referencia, periodo, pagador_cnpj, hash_excel, hash_pdf })` → linha ou null.
- `salvarAnalise(payload)` — upsert por `(empresa_id, mes_referencia, periodo, pagador_cnpj)` (substitui registro anterior, mantém histórico via campo `data_analise` atualizado e `created_at` original).
- Helpers para extrair valores consolidados a partir de `ComparacaoResultado` e `ComparacaoSimplificada` e calcular `status_analise` (OK quando `divergencias.length === 0` e há PDF; ERRO caso contrário; PENDENTE quando faltam arquivos).

## 3. Integração no fluxo de análise atual

`AnaliseExcelRow.tsx` (e ponto onde a análise é disparada em `Financeiro.tsx`):
- Antes de processar Excel/PDF: gerar hashes e consultar `financeiro_analises`. Se houver match exato → carregar `resultado_completo` no estado, exibir toast "Análise carregada do histórico".
- Após análise nova: persistir no banco com `salvarAnalise`.
- Botão **Reanalisar** ao lado do "Verificar PDF": limpa cache local + força reprocessamento + atualiza linha no banco.
- Ao montar `Financeiro.tsx`, prefetch das análises salvas do mês corrente para popular `analiseResultados` / `analiseComparacoes` sem clique do usuário.

## 4. Exportar Erros

Reescrever `handleExportErros` em `src/pages/Financeiro.tsx` para:
- `SELECT * FROM financeiro_analises WHERE mes_referencia = $mes AND status_analise = 'ERRO'`.
- Iterar `divergencias` jsonb e gerar planilha com colunas:
  Empresa, Contrato, CNPJ, Pagador, Competência, Status, Tipo, Campo, Valor Excel, Valor PDF, Diferença, Mensagem, Data da Análise, Usuário.
- Não tocar nos arquivos originais.

## 5. Histórico de Análises (UI)

Novo componente `src/components/financeiro/HistoricoAnalisesDialog.tsx`:
- Aberto por botão "Histórico de análises" no header da página, ao lado de "Exportar erros".
- Lista paginada/filtrável por mês, empresa, status.
- Colunas: Empresa, Contrato, Competência, Pagador, Status (badge verde/vermelho), Data, Usuário, Arquivos.
- Ações por linha: "Ver detalhes" (sub-dialog mostrando `resultado_completo` formatado com a mesma UI já usada no inline) e "Reanalisar" (apaga registro e dispara nova análise).

## 6. Não escopo / cuidados

- Não salvar bytes dos arquivos — só metadados, hashes e resultado consolidado.
- Manter compatibilidade com análises antigas (se faltar registro, fluxo atual continua valendo).
- Não alterar parsers de Excel/PDF.
- Status final do banco é a verdade — `Exportar Erros` nunca recalcula divergências.

## Arquivos
- novo: `supabase/migrations/<ts>_financeiro_analises.sql`
- novo: `src/lib/financeiro-analise-cache.ts`
- novo: `src/components/financeiro/HistoricoAnalisesDialog.tsx`
- editado: `src/pages/Financeiro.tsx` (prefetch, handleExportErros, botão histórico)
- editado: `src/components/financeiro/AnaliseExcelRow.tsx` (cache + Reanalisar)
