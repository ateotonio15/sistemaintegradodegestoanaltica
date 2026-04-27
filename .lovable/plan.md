## 🎯 Objetivo

Adicionar um **ícone de seta** na coluna **Ações** de cada linha do Financeiro que, ao clicar, **lê todos os Excels anexados** àquela movimentação e exibe — em uma **linha expandida abaixo** (mesmo padrão visual da tabela) — uma análise consolidada por **pagador** (1 análise por XLS), classificando os planos em **Enfermaria** vs **Apartamento** e separando as **Inclusões**.

---

## 📋 Escopo

### 1. UI — Ícone de seta na linha (`FinanceiroTable.tsx`)

- Novo botão **ghost icon** na coluna **Ações** (entre `Pencil` e `Bell`), usando `ChevronDown` do `lucide-react` (gira para `ChevronUp` quando expandido).
- Mesmo padrão visual já usado: `variant="ghost"`, `size="icon"`, `h-8 w-8`, `h-3.5 w-3.5` no ícone, `title="Analisar Excel"`.
- Estado local no componente: `expandedRowId: string | null` (apenas 1 linha expandida por vez).
- Ao clicar:
  - Se a linha já estava expandida → recolhe.
  - Senão → expande e dispara a análise dos anexos XLS daquela movimentação.

### 2. Linha expandida (mesmo padrão visual)

- **NOVO componente**: `src/components/financeiro/AnaliseExcelRow.tsx`
- Renderizada como uma **`<TableRow>` adicional** logo após a linha clicada, com `<TableCell colSpan={12}>` — ocupando ponta a ponta sem quebrar o grid.
- Visual: `bg-muted/30 border-l-2 border-l-primary` (continuação natural, alinhado com o padrão `border-l-destructive` já usado para overdue).
- Conteúdo:
  - **Estado vazio**: se a movimentação não tem nenhum XLS/XLSX/CSV anexado → texto centralizado `"Nenhum Excel anexado para análise."` com ícone `FileX`.
  - **Loading**: spinner `Loader2 animate-spin` + `"Analisando planilha(s)..."`.
  - **Resultado**: para cada XLS anexado, renderiza um **bloco "Pagador: <nome do arquivo>"** contendo uma mini-tabela (mesmo `Table` do shadcn, sem bordas externas):

| Categoria | Beneficiários | Mensalidade | Total |
|---|---|---|---|
| Enfermaria | X | R$ X,XX | R$ X,XX |
| Apartamento | X | R$ X,XX | R$ X,XX |

  - **Linha de Inclusões** abaixo da mini-tabela (mesmo padrão de "subtítulo + valores"):
    - `Inclusões: <quantidade> · Total: R$ X,XX`
  - **Avisos de leitura**: se a coluna "Plano" ou "Tipo Cobrança" não foi encontrada na planilha → `Alert` warning (`border-warning/50 bg-warning/10`) listando exatamente quais colunas faltaram, ex.: `"Não foi possível identificar a coluna 'Tipo Cobrança' em <arquivo.xlsx>"`.

### 3. Lógica de leitura — `src/lib/excel-analysis-utils.ts` (NOVO)

Reutiliza a biblioteca **`exceljs`** (já instalada — substitui o antigo `xlsx`).

#### Função principal
```ts
analisarExcelFinanceiro(buffer: ArrayBuffer): {
  pagador: string;             // será preenchido pelo nome do arquivo no caller
  enfermaria: { beneficiarios: number; mensalidade: number; total: number };
  apartamento: { beneficiarios: number; mensalidade: number; total: number };
  inclusoes: { quantidade: number; total: number };
  avisos: string[];            // colunas não encontradas, etc.
}
```

#### Detecção de colunas (case/acento-insensitive)
- Normalização: `.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()`
- Procura cabeçalho **"Plano"** → aceita variações: `plano`, `planos`, `tipo plano`, `tipo de plano`
- Procura cabeçalho **"Tipo Cobrança"** → aceita: `tipo cobranca`, `tipo de cobranca`, `tipo cobrança`, `cobranca`
- Procura cabeçalho **valor** (mensalidade) → aceita: `valor`, `mensalidade`, `valor mensalidade`, `vlr`, `preco`
- Varre as **primeiras 10 linhas** para localizar a linha de cabeçalho (planilhas reais têm logos/títulos no topo).
- Se **"Plano"** ou **"Tipo Cobrança"** não forem encontrados → adiciona aviso e retorna zeros para a categoria afetada (não trava o resto).

#### Classificação de planos (similaridade simples)
- Tabela de equivalências (normalizada):
  - **Enfermaria**: contém `coletivo empresarial master` **OU** `master empresarial` **OU** `enfermaria`
  - **Apartamento**: contém `master executivo` **OU** `coletivo executivo master` **OU** `apartamento`
  - Outros → ignorados (não somam em nenhuma categoria).

#### Identificação de Inclusões
- Para cada linha de dados, verifica a coluna **"Tipo Cobrança"** normalizada:
  - Se contém `inclusao` ou `inclusão` → conta na seção **Inclusões** (não soma em Enfermaria/Apartamento).
  - Senão → soma na categoria do plano (regra acima).

#### Cálculos
- **Beneficiários**: contagem de linhas válidas por categoria.
- **Mensalidade**: média dos valores da categoria (ou repete o valor único quando todas as linhas têm o mesmo valor — evita exibir números esquisitos quando há divergência por idade).
- **Total**: soma direta dos valores da categoria (mais confiável que `beneficiarios × mensalidade` quando há faixas etárias).
- **Inclusões.total**: soma dos valores das linhas marcadas como inclusão.
- Linhas com valor inválido (NaN/negativo) → ignoradas, não geram erro.

### 4. Integração — `Financeiro.tsx`

- Já existe `anexosMap` carregado com `nome_arquivo`, `mime_type`, `storage_path` etc. **Adicionar `storage_path` ao select** (linha 152) — atualmente não está incluído.
- Função `handleAnalisar(row)`:
  - Filtra `anexosMap[row.id]` pelos que são XLS (`isXlsAnexo` já existe em `financeiro-utils.ts`).
  - Para cada um: `supabase.storage.from("anexos-financeiro").download(storage_path)` → `arrayBuffer()` → `analisarExcelFinanceiro(buffer)` → set `pagador = nome_arquivo`.
  - Resultado guardado em estado local `Record<string, AnaliseResultado[]>` por movimentação id (cache em memória durante a sessão).
- Passa `expandedRowId`, `onToggleExpand`, `analiseResultados`, `analiseLoading` para `<FinanceiroTable>`.

### 5. Permissão

- Já protegido pelo guard da página: `canManageFinanceiro` (Admin + Financeiro).
- Download de anexos via signed URL já funciona pelos RLS atuais do bucket `anexos-financeiro` (Admin + Financeiro — `ALL`).
- Nenhuma mudança de RLS necessária.

### 6. Formatação de moeda

- Reutilizar `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- Helper local no novo arquivo: `formatBRL(n: number): string`.

### 7. UX

- **Loading**: spinner inline na linha expandida.
- **Sem XLS**: `"Nenhum Excel anexado"` (texto cinza centralizado, sem `toast` — está dentro da própria linha).
- **Erro de download/parse**: `toast.error("Erro ao analisar <arquivo>: <mensagem>")` + mostra o que conseguiu processar dos demais.
- **Múltiplos pagadores**: cada XLS gera 1 bloco separado dentro da linha expandida (vertical, com separador `border-t`).
- **Recolher**: clicar de novo no `ChevronUp` ou em outra linha (qualquer outra expansão fecha a anterior).

---

## 📂 Arquivos afetados

- ✏️ **`src/components/financeiro/FinanceiroTable.tsx`** — adicionar botão `ChevronDown/Up`, suportar linha expandida via novas props, renderizar `<AnaliseExcelRow>`.
- ✏️ **`src/pages/Financeiro.tsx`** — incluir `storage_path` no select de anexos, estado de expansão + cache de análises, função `handleAnalisar`.
- ➕ **`src/lib/excel-analysis-utils.ts`** — função `analisarExcelFinanceiro` + helpers de detecção/classificação/formatação.
- ➕ **`src/components/financeiro/AnaliseExcelRow.tsx`** — componente da linha expandida (estados: vazio/loading/resultado/aviso).

## 🚫 Fora do escopo

- A "segunda etapa" da análise (mencionada como futura) — não implementar agora.
- PDFs não são analisados (apenas XLS/XLSX/CSV).
- Análise não é persistida no banco — recalculada sob demanda (cache só em memória).
- Sem alterações de RLS, schema ou storage.