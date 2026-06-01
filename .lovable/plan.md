# Período Específico de Cobrança

## Objetivo
Permitir que empresas sejam faturadas por um intervalo de 30 dias (ex: 13/05 → 12/06) em vez da competência mensal padrão. O usuário informa apenas a data inicial; o sistema calcula a final como "mesmo dia do mês seguinte − 1 dia". Para meses subsequentes, mantém o mesmo dia inicial, ajustando virada de mês/ano e meses curtos.

## Banco de dados
Adicionar em `empresas`:
- `periodo_especifico_cobranca` (boolean, default false)
- `periodo_cobranca_inicio` (date, nullable) — data inicial **base** (referência para todos os ciclos)

> Não armazenamos a data final: ela é sempre derivada do dia inicial + 1 mês − 1 dia.

## Cálculo (nova util em `src/lib/date-utils.ts`)
```ts
calcularPeriodoCobranca(dataBase: Date, mesReferencia: string): { inicio: Date; fim: Date }
```
Regra:
1. Extrai dia base `D` da `data_inicio`.
2. Para um `mes_referencia` (YYYY-MM), o início = `D` daquele mês (ajustado se não existir, ex: 31/fev → último dia).
3. Fim = mesmo dia do mês seguinte − 1 dia. Usar aritmética segura (sem somar 30 dias fixos).

Formatador: `formatPeriodoCobranca(inicio, fim)` → `"13/05/2026 à 12/06/2026"`.

## Aba Empresas — Configurações Financeiras
Em `ConfigFinanceiraEmpresaDialog.tsx`, adicionar nova seção **"Período de cobrança"**:
- Select: "Possui período específico de cobrança?" (Sim/Não)
- Se Sim: campo `DatePicker` "Data inicial do período" + label readonly "Data final (calculada): DD/MM/AAAA"
- Validação: se Sim → data inicial obrigatória.
- Persistir nos campos novos da `empresas`.
- Atualizar `empresa-financeiro-config.ts` (schema Zod + interface).
- Permissão: apenas admin pode editar (desabilitar inputs caso não seja admin).

## Aba Financeiro
Em `FinanceiroTable.tsx` (e onde exibe competência), quando a empresa tiver período específico:
- Exibir `"Período de: 13/05/2026 à 12/06/2026"` no lugar (ou abaixo) da competência.
- Manter `mes_referencia` no DB intacto — apenas substituir a apresentação.
- Filtros, ordenação, análise Excel x PDF e exportações continuam usando `mes_referencia`.

Em `PeriodSummary.tsx` exibir também o período específico quando aplicável (quando todas/uma empresa filtrada tiver período).

## Histórico Financeiro
Em `src/lib/historico-utils.ts`:
- Adicionar opt `periodoCobranca?: { inicio: string; fim: string } | null`.
- Se presente, primeira linha vira `"Período de: 13/05/2026 à 12/06/2026."` em vez de `"Período de: Junho/2026."`.

Em `GerarHistoricoDialog.tsx`:
- Buscar `periodo_especifico_cobranca`, `periodo_cobranca_inicio` da empresa.
- Calcular período para o `mes_referencia` da movimentação e passar para `gerarHistoricoTexto`.

## Não afetar
- Geração de movimentações, status, anexos, importação Excel, análises, alertas — todos continuam por `mes_referencia`. O período é apenas display + histórico.

## Arquivos alterados
- migration: `empresas` (+2 colunas)
- `src/lib/date-utils.ts` (+ helpers)
- `src/lib/empresa-financeiro-config.ts`
- `src/lib/historico-utils.ts`
- `src/components/financeiro/ConfigFinanceiraEmpresaDialog.tsx`
- `src/components/financeiro/GerarHistoricoDialog.tsx`
- `src/components/financeiro/FinanceiroTable.tsx`
- `src/components/financeiro/PeriodSummary.tsx`
- `src/pages/Financeiro.tsx` (passar empresa data para tabela)
