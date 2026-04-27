## Objetivo
Estender a análise de Excel já existente (linha expandida acionada pela seta na coluna **Ações**) para também ler o(s) **PDF(s)** anexado(s) na movimentação, comparar com o Excel e mostrar **✔️/❌** ao lado de cada valor, listando as divergências encontradas.

A regra: **Excel = fonte de verdade**, PDF é validado contra ele.

---

## 1. Leitura de PDF — nova lib

Hoje o projeto só tem `exceljs`. Para extrair texto do PDF no client (sem servidor) vou adicionar:

- **`pdfjs-dist`** (Mozilla, padrão de mercado, ~zero deps, funciona no Vite/browser)

Uso: carregar o PDF como `ArrayBuffer` → `getDocument()` → percorrer páginas → `getTextContent()` → concatenar strings preservando ordem de leitura.

---

## 2. Novo utilitário `src/lib/pdf-analysis-utils.ts`

Responsável por extrair, do texto do PDF, a seção **"Serviço Prestado"** (boleto/fatura padrão Samel) e devolver:

```ts
export interface PdfCategoria {
  beneficiarios: number | null; // null = não encontrado (inclusões)
  mensalidade: number | null;
  total: number;
}

export interface AnalisePdfResultado {
  arquivo: string;
  enfermaria: PdfCategoria;
  apartamento: PdfCategoria;
  inclusoes: { total: number };  // PDF não tem qtd de inclusões — ignorar
  avisos: string[];
}

export async function analisarPdfFinanceiro(buffer: ArrayBuffer): Promise<Omit<AnalisePdfResultado, "arquivo">>;
```

### Estratégia de parsing (regex tolerantes)
- Normalizar texto: minúsculas, sem acento, espaços compactados.
- Localizar bloco entre "servico prestado" (ou "serviço prestado") e o próximo cabeçalho/total da fatura.
- Para cada linha do bloco, identificar a categoria pelo mesmo classificador já usado no Excel (`coletivo empresarial master`/`master empresarial` → enfermaria, `master executivo`/`coletivo executivo master` → apartamento, contém `inclusao`/`inclusão` → inclusões).
- Extrair, na mesma linha (ou linha imediatamente seguinte), os números nesta ordem comum em fatura: `qtd | valor unit | total`. Aceitar formato BRL (`1.234,56`).
- Para **inclusões**, capturar apenas o valor total (qtd e unitário ficam `null`).
- Tudo que não casar entra em `avisos` (ex.: "Não foi possível identificar a linha de Apartamento no PDF").

> Caso o PDF não seja um boleto Samel (layout diferente), os avisos guiam o usuário e a comparação ainda funciona para o que conseguiu extrair.

---

## 3. Atualização de `src/lib/excel-analysis-utils.ts`

Adicionar uma função de comparação pura (sem UI):

```ts
export interface CampoValidacao<T = number> {
  excel: T;
  pdf: T | null;
  ok: boolean;
}

export interface ComparacaoCategoria {
  beneficiarios: CampoValidacao<number>;
  mensalidade: CampoValidacao<number>;
  total: CampoValidacao<number>;
}

export interface ComparacaoResultado {
  pagador: string;
  arquivoPdf: string | null;
  enfermaria: ComparacaoCategoria;
  apartamento: ComparacaoCategoria;
  inclusoes: { total: CampoValidacao<number> }; // só total
  divergencias: string[]; // mensagens prontas para exibição
}

export function compararExcelComPdf(
  excel: AnaliseResultado,
  pdf: AnalisePdfResultado | null,
): ComparacaoResultado;
```

Regras:
- Tolerância numérica: `Math.abs(a-b) < 0.01` para valores monetários; igualdade exata para inteiros (beneficiários).
- Se PDF não tem o campo → `pdf: null`, `ok: false`, e divergência: *"Categoria X não encontrada no PDF"*.
- Mensagens de divergência específicas: *"Divergência na mensalidade da enfermaria (Excel R$ 450,00 × PDF R$ 460,00)"*.

---

## 4. Pipeline em `src/pages/Financeiro.tsx` — `handleToggleExpand`

Hoje a função baixa apenas XLS. Vou estender:

1. Filtrar anexos em **dois grupos**: `xlsAnexos` (já existe) e `pdfAnexos` (novo, via `isPdfAnexo`).
2. Cache-key passa a considerar storage_paths de **XLS + PDF** (qualquer mudança invalida).
3. Para cada XLS:
   - Baixar e analisar (já existe).
   - Tentar parear com um PDF — heurística: pega o **PDF mais recente** disponível (a movimentação geralmente tem 1 PDF de fatura). Se houver vários PDFs e vários XLS, usar o índice (1º PDF ↔ 1º XLS); fallback para o mais recente.
   - Baixar o PDF (se existir), analisar via `analisarPdfFinanceiro`, gerar `ComparacaoResultado` via `compararExcelComPdf`.
4. Estado novo: `analiseComparacoes: Record<string, ComparacaoResultado[]>` (substitui ou complementa `analiseResultados`).

Tratamento de erro idêntico ao XLS: erro vira `toast.error` + `aviso` no card.

---

## 5. UI — `src/components/financeiro/AnaliseExcelRow.tsx`

Manter o mesmo padrão visual (linha expandida com `bg-muted/30 border-l-2 border-l-primary`, mesma tabela 4 colunas), agora exibindo **3 colunas de valor por categoria** com ícone ao lado:

```
| Categoria   | Beneficiários         | Mensalidade            | Total                  |
| Enfermaria  | 12 ✔                  | R$ 450,00 ✔            | R$ 5.400,00 ✔          |
| Apartamento | 8 ✘ (PDF: 7)          | R$ 720,00 ✔            | R$ 5.760,00 ✘          |
| Inclusões   | —                     | —                      | R$ 320,00 ✔            |
| Total Geral |                       |                        | R$ 11.480,00           |
```

- Componente `<ValorComCheck value={...} validacao={...}>` reutilizável:
  - `CheckCircle2` (verde, `text-success`) quando `ok=true`
  - `XCircle` (vermelho, `text-destructive`) quando `ok=false`
  - tooltip no ✘ mostrando o valor do PDF
  - se não há PDF anexado → **sem ícone**, comportamento igual ao atual (apenas mostra Excel)

Continuar respeitando: **só renderiza categoria que existe** (regra já implementada — não mostrar zerados).

### Bloco de divergências
Logo abaixo da tabela, quando houver `divergencias.length > 0`:

```
<Alert variant="destructive" /* já existe no projeto */>
  <AlertTriangle />
  <AlertTitle>Divergências identificadas</AlertTitle>
  <AlertDescription>
    <ul className="list-disc ml-4 text-xs">
      <li>Divergência na mensalidade da enfermaria...</li>
      <li>Total do apartamento não confere com o PDF...</li>
    </ul>
  </AlertDescription>
</Alert>
```

Se **não houver PDF anexado** → manter a UI atual (sem ícones, sem bloco de divergências, apenas o resumo do Excel).
Se **só houver PDF** (sem Excel) → exibir aviso: *"Anexe o Excel da movimentação para validação cruzada."* (não tem fonte de verdade pra comparar).

---

## 6. Arquivos afetados

| Arquivo | Mudança |
|--------|---------|
| `package.json` | + `pdfjs-dist` |
| `src/lib/pdf-analysis-utils.ts` | **novo** — extrai dados do PDF |
| `src/lib/excel-analysis-utils.ts` | + função `compararExcelComPdf` e tipos de validação |
| `src/pages/Financeiro.tsx` | `handleToggleExpand` baixa também PDF, gera `ComparacaoResultado[]` |
| `src/components/financeiro/AnaliseExcelRow.tsx` | renderiza ✔/✘ por campo + bloco de divergências |
| `src/components/financeiro/FinanceiroTable.tsx` | passa o novo prop (`analiseComparacoes`) — mudança trivial de tipo |

Nada de novo layout/cor/componente fora do padrão existente — apenas reaproveitamos `Alert`, `Tooltip`, `CheckCircle2`/`XCircle` da Lucide e os tokens de cor `text-success`/`text-destructive` já no design system.

---

## 7. Edge cases tratados

- PDF sem seção "Serviço Prestado" → `aviso` específico, ✘ em todos os campos do PDF.
- Múltiplos pagadores (vários XLS) com 1 só PDF → o mesmo PDF é comparado com cada XLS (boleto único costuma ter as duas categorias).
- PDF contém categoria que o Excel não tem → divergência: *"Categoria Apartamento aparece no PDF mas não no Excel"*.
- Valores em centavos no PDF (ex.: `R$ 5.760,00` vs `5760`) → normalização BRL idêntica à do Excel.
- Tolerância de R$ 0,01 evita falso ✘ por arredondamento.