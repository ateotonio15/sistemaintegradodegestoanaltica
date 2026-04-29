## Escopo

Tudo abaixo vive **somente na aba Financeiro**. Nenhum trigger, RPC ou tela do Cadastro/Operacional/Comercial é alterado.

---

## 1. "Data de vencimento" → seletor de dia (01–31)

**Onde:** `EditarMovimentacaoDialog.tsx` (campo `data_vencimento`).

- Substituir o `<Input type="date">` por um `<Select>` com opções `01`–`31` + "— Não definido —".
- **Armazenamento (compatível):** continuar gravando em `financeiro_movimentacoes.data_vencimento` como `date`, montando `YYYY-MM-DD` a partir do `mes_referencia` da movimentação (ex.: `2026-04` + dia `15` → `2026-04-15`). Assim nada quebra no banco, exports e gráficos existentes.
- Remover a validação "vencimento anterior ao envio" (perde sentido com dia puro) e ajustar o aviso correspondente.
- Tabela (`FinanceiroTable.tsx`) já exibe só o dia via `formatDay` — mantido.
- Export Excel: continuar usando `formatDateBR` (data completa) — não impacta usuário, é dado interno.

---

## 2. Novo campo "Tipo de análise" (somente Financeiro)

**Coluna nova no banco** — migration:

```sql
ALTER TABLE public.financeiro_movimentacoes
  ADD COLUMN tipo_analise text NOT NULL DEFAULT 'normal';
-- valores aceitos: 'normal' | 'faixa_etaria' | 'moto_honda'
ALTER TABLE public.financeiro_movimentacoes
  ADD CONSTRAINT chk_tipo_analise
  CHECK (tipo_analise IN ('normal','faixa_etaria','moto_honda'));
```

Default `'normal'` cobre todos os contratos existentes e novos automaticamente.

**UI no `EditarMovimentacaoDialog`:** novo `<Select>` "Tipo de análise" no espaço destacado em amarelo (ao lado de "Data de envio da nota"), com:
- Análise normal *(padrão)*
- Análise faixa etária
- Análise Moto Honda

Salvar junto com os demais campos no `update`.

Mostrar também um badge discreto na linha expandida da tabela ("Análise: Moto Honda") para o Financeiro saber qual parser está rodando.

---

## 3. Pipeline de análise condicional

**`src/pages/Financeiro.tsx` (função `runAnalise`)** passa a despachar pelo `row.tipo_analise`:

```text
tipo_analise === 'normal'        → analisarExcelFinanceiro      (atual, sem mudança)
tipo_analise === 'faixa_etaria'  → analisarExcelFinanceiro      (igual ao normal por enquanto)
tipo_analise === 'moto_honda'    → analisarExcelMotoHonda       (NOVO, lê aba RESUMO)
```

PDF roda igual para os 3 tipos (`analisarPdfFinanceiro`), mas com **fallback simplificado** quando for Moto Honda (item 4).

---

## 4. Parser Excel "Moto Honda" — aba RESUMO

**Novo arquivo:** `src/lib/excel-analysis-moto-honda.ts`

Lê **somente** a aba `RESUMO` do `.xlsx`. Mapeamento confirmado pelo arquivo enviado:

| Linha RESUMO       | Sistema      | Campos extraídos                  |
|--------------------|--------------|-----------------------------------|
| `M.Empresarial`    | Enfermaria   | Qtd, Mensalidade, Valor           |
| `M.Executivo`      | Apartamento  | Qtd, Mensalidade, Valor           |
| `Proporcional / Inclusoes` | Inclusões | Valor (qtd não vem) |
| `Proporcional / Exclusoes` | Exclusões (novo) | Valor (negativo) |

Algoritmo:
1. Procurar a worksheet com nome normalizado igual a `resumo` (sem acento, lowercase).
2. Varrer todas as linhas, casar a primeira célula por contém `m.empresarial`, `m.executivo`, `inclus`, `exclus`.
3. Coluna B = qtd (int), C = mensalidade (number), D = valor total (number; pode ser negativo).
4. Retornar `AnaliseResultado` no mesmo shape atual (`enfermaria`, `apartamento`, `inclusoes`) + novo campo opcional `exclusoes: { quantidade, total }`.
5. Se `RESUMO` não existir → aviso "Aba RESUMO não encontrada — não buscar dados em outras abas." e retornar zeros.

**Ajuste no tipo `AnaliseResultado`:** adicionar `exclusoes?: { quantidade: number; total: number }` (opcional para não quebrar parser normal).

**`AnaliseExcelRow.tsx`:** quando `exclusoes` vier preenchido, renderizar uma 4ª linha "Exclusões" com total negativo em cor `text-destructive`.

---

## 5. PDF Moto Honda — fallback simplificado

**Em `src/lib/pdf-analysis-utils.ts`** adicionar uma análise alternativa:

```ts
export async function analisarPdfFinanceiroSimplificado(buffer): Promise<{
  beneficiarios: number | null;
  inclusoes: { quantidade: number | null; total: number };
  exclusoes: { quantidade: number | null; total: number };
}>
```

Regex aplicada sobre o texto extraído (reaproveitar `extrairTextoPdf`):
- `total\s*de\s*beneficiarios?\s*[:\-]?\s*(\d+)` ou `(\d+)\s*beneficiarios?`
- `inclus(?:ao|ões|oes)\s*[:\-]?\s*(?:(\d+)\s*[xX×])?\s*(R?\$?\s*[\d.,]+)` (qtd opcional + valor)
- `exclus(?:ao|ões|oes)\s*[:\-]?\s*(?:(\d+)\s*[xX×])?\s*(R?\$?\s*[\d.,-]+)`

**Decisão automática (em `runAnalise`, branch Moto Honda):**

```text
1. Roda analisarPdfFinanceiro (completo)
2. SE pdf.enfermaria.total > 0 OU pdf.apartamento.total > 0 OU pdf.<algum>.mensalidade != null
     → usa análise completa (compararExcelComPdf como hoje)
   SENÃO
     → roda analisarPdfFinanceiroSimplificado e usa um novo
       compararExcelComPdfSimplificado(excel, pdfSimples) que valida apenas
       beneficiários totais, inclusões (valor) e exclusões (valor).
```

Resultado simplificado renderizado pelo mesmo `AnaliseExcelRow` adicionando uma seção "Validação simplificada (Moto Honda)" abaixo das categorias quando aplicável.

---

## 6. Detalhes técnicos finais

- **Migration:** uma só, contendo apenas o `ALTER TABLE` da coluna `tipo_analise`.
- **Sem mudanças em RLS, triggers ou funções existentes.**
- **`types.ts` (Supabase) é regenerado automaticamente** após a migration; o código TS lê `tipo_analise` via `Tables<"financeiro_movimentacoes">`.
- **Cache de análise (`_key`)** em `Financeiro.tsx` passa a incluir `row.tipo_analise` para refazer a análise quando o usuário trocar o tipo.
- **Nenhuma alteração** em: Cadastro, Movimentações, Dashboard operacional, alertas, Saúde, Painel Executivas.

## Arquivos tocados

- `supabase/migrations/<nova>.sql` — coluna `tipo_analise`.
- `src/components/financeiro/EditarMovimentacaoDialog.tsx` — vencimento como dia + select tipo de análise.
- `src/components/financeiro/FinanceiroTable.tsx` — badge do tipo de análise (linha expandida).
- `src/components/financeiro/AnaliseExcelRow.tsx` — renderização de exclusões e bloco "validação simplificada".
- `src/lib/excel-analysis-utils.ts` — campo `exclusoes?` no tipo + comparador simplificado.
- `src/lib/excel-analysis-moto-honda.ts` — **novo**, parser da aba RESUMO.
- `src/lib/pdf-analysis-utils.ts` — função `analisarPdfFinanceiroSimplificado`.
- `src/pages/Financeiro.tsx` — despacho por `tipo_analise` + decisão completa/simplificada do PDF.
