
## Escopo
Tudo é exclusivo da aba **Financeiro** (`/financeiro`). Nenhuma outra área é afetada.

## 1. Modelo de dados — tabela `a_receber`
Criar nova tabela para armazenar registros de "A Receber" gerados automaticamente após validação.

Colunas:
- `id uuid pk`
- `financeiro_movimentacao_id uuid` (vínculo com a movimentação financeira)
- `empresa_id uuid`, `empresa_nome text`, `empresa_cnpj text`
- `valor_total numeric` (Valor Líquido da NFS-e — extraído do PDF)
- `valor_faturado numeric` (Faturado bruto — Excel)
- `valor_inclusoes numeric`, `valor_exclusoes numeric`
- `beneficiarios int`
- `nf_numero text` (extraído do PDF quando disponível)
- `dia_vencimento smallint` (1–31, somente o dia)
- `data_vencimento date` (opcional, completa)
- `periodo text` (ex: "01-05")
- `mes_referencia text`
- `status text default 'Pendente'`
- `created_at`, `updated_at`

RLS: igual a `financeiro_movimentacoes` (Admin + Financeiro CRUD; demais autenticados leitura).

UNIQUE constraint em `financeiro_movimentacao_id` para evitar duplicatas.

## 2. Geração automática

### Onde
No fim de `runAnalise` em `src/pages/Financeiro.tsx`, após calcular `comparacoes`.

### Critério de "validado" (sem divergência)
Para cada movimentação:
- `xlsAnexos.length > 0` **E** `pdfsValidos.length > 0`
- Pelo menos uma `comparacao` retornada
- **Toda** comparação tem `divergencias.length === 0`
- Para análise normal: pelo menos uma categoria (enfermaria/apartamento) presente
- Para Moto Honda simplificado: `beneficiarios.ok` quando aplicável

### Ação
Se válido → `upsert` em `a_receber` com:
- `valor_total` = Valor Líquido da NFS-e do PDF (precisa ser extraído — ver §3)
- `beneficiarios` = soma das categorias do Excel (ou total Moto Honda)
- `dia_vencimento` = `empresas.data_vencimento_fatura` da empresa, ou dia extraído do PDF
- `periodo` = `row.periodo`
- `status` = "Pendente"

Toast de sucesso discreto: "A Receber gerado para {empresa}".

Se inválido (divergência ou dados incompletos) → não gera (e remove se já existir um registro órfão para essa movimentação? **decisão:** não remove, apenas não cria. Mantém histórico.)

## 3. Extrair "Valor Líquido da NFS-e" do PDF
Em `src/lib/pdf-analysis-utils.ts`:
- Adicionar campo `valorLiquido: number | null` a `AnalisePdfResultado` e `AnalisePdfSimplificado`.
- Adicionar campo `nfNumero: string | null` (regex em "NFS-e nº" / "Nº" próximo do topo).
- Regex: `/valor\s*l[ií]quido\s*da\s*nfs[\-\s]?e\s*r?\$?\s*([\d.,]+)/i`
- Bumpar `ANALISE_PARSER_VERSION` para `"5"` para invalidar cache.

## 4. Botão "PRÊMIO" + exportação

### UI (`src/pages/Financeiro.tsx`)
Adicionar ao header, ao lado de "Exportar Excel":
- Botão **"PRÊMIO"** (ícone Trophy)
- Abre `Popover` ou `DropdownMenu` com:
  - 6 opções de período como `RadioGroup`: `01-05`, `05-10`, `10-15`, `15-20`, `20-25`, `25-30`
  - Opção "Geral (todos os períodos)" (default)
  - Botão "Exportar PRÊMIO"

### Filtro
- Lê apenas registros válidos da tabela `a_receber` para o `mes_referencia` selecionado.
- Se um período for escolhido, filtra `WHERE periodo = ...`.
- Se nenhum, exporta todos.

### Formato Excel (espelha o template enviado)
Colunas exatas, na ordem do modelo `reportCFIN`:
```
CNPJ | Pagador | Nf | Dt emissao | Dt vencimento | Dt Prorrog | Total vidas |
Vidas proporcional | Vidas enfermaria | Vl Enfermaria | Total Enfermaria |
Dt recebimento | Mensalidade | Inclusoes | Exclusoes | Comp mensalidade |
Faturado | a receber | Recebido | Amaior | Juros | Cobertura mensalidade |
Historico mensalidade
```
- Preenche o que tem (`empresa_cnpj`, `empresa_nome`, `nf_numero`, `valor_inclusoes`, `valor_exclusoes`, `valor_faturado`, `valor_total` em "a receber", `dia_vencimento`).
- Campos sem dado → vazio (não preenche, conforme pedido do usuário).
- Cabeçalho em negrito, larguras adequadas.
- Nome do arquivo: `premio_{mes}_{periodo|geral}_{YYYYMMDD}.xlsx`.

### Permissão
Botão visível apenas para `canManageFinanceiro` (Admin/Financeiro), igual ao Exportar.

## 5. Recarregar dados
Após `runAnalise` gerar um "A Receber", invalidar `queryClient.invalidateQueries({ queryKey: ["a_receber"] })` para que a próxima exportação PRÊMIO já encontre o registro.

## Arquivos afetados
- **migração SQL** (nova): tabela `a_receber` + RLS + UNIQUE.
- `src/lib/pdf-analysis-utils.ts` — extrair valor líquido + nº NF.
- `src/lib/excel-analysis-utils.ts` — helper `analiseEstaValidada(comparacao)` exportado.
- `src/pages/Financeiro.tsx` — geração automática no `runAnalise`, botão PRÊMIO + dialog, query de `a_receber`.
- `src/lib/premio-export.ts` (novo) — função `exportarPremio(rows, periodo?)` que monta o Excel no formato do template.

## Notas técnicas
- A geração só dispara **quando o usuário expande a linha** (`runAnalise`) — é o único momento em que temos Excel+PDF analisados. Não introduzimos job background.
- O upsert usa `financeiro_movimentacao_id` como chave, então re-análises atualizam o mesmo registro em vez de duplicar.
- Tudo client-side, sem edge function.
