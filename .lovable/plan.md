# Auto-preenchimento de "Data de Emissão" (Financeiro)

## Regra
A "Data de Emissão" (`dia_emissao`) é calculada automaticamente a partir do período da movimentação:

- Pega o último dia do intervalo do período.
- Soma +2 dias.
- Define como `dia_emissao`.

Mapeamento resultante:

| Período | dia_emissao |
|---|---|
| 01-05 | 07 |
| 05-10 | 12 |
| 10-15 | 17 |
| 15-20 | 22 |
| 20-25 | (não alterar — manter como está) |
| 25-30 | (não alterar — manter como está) |

## Regras de preservação
- Se `dia_emissao` já estiver preenchido, **nunca** sobrescreve.
- Períodos 20-25 e 25-30 ficam intocados, mesmo se vazios (lógica atual continua valendo).
- Backfill aplicado uma única vez agora; sem trigger automático para o futuro.

## Implementação

### 1. Backfill no banco (operação única)
`UPDATE financeiro_movimentacoes` definindo `dia_emissao` apenas onde:
- `dia_emissao IS NULL`
- `periodo IN ('01-05','05-10','10-15','15-20')`

Mapeamento via `CASE`: 01-05→7, 05-10→12, 10-15→17, 15-20→22.

### 2. Default no frontend (criação/edição)
Em `EditarMovimentacaoDialog.tsx`, ao abrir uma movimentação:
- Se `movimentacao.dia_emissao` está vazio **e** período ∈ {01-05, 05-10, 10-15, 15-20} → pré-seleciona o dia calculado.
- Caso contrário mantém o comportamento atual.

Isso garante que novas edições/salvamentos resultem em `dia_emissao` populado sem mudar a UX (o usuário ainda pode trocar manualmente antes de salvar).

### 3. Helper utilitário
Adicionar em `src/lib/financeiro-utils.ts`:
```ts
export function calcularDiaEmissaoPadrao(periodo: string): number | null {
  const map: Record<string, number> = {
    "01-05": 7, "05-10": 12, "10-15": 17, "15-20": 22,
  };
  return map[periodo] ?? null;
}
```
Usado tanto pelo dialog quanto por qualquer fluxo futuro.

## Exibição
Já existe em `FinanceiroTable.tsx`: `Emissão dia XX`. Sem mudanças visuais.

## Resumo técnico
- 1 migração de dados (UPDATE com WHERE restrito).
- 1 helper novo em `financeiro-utils.ts`.
- 1 edit em `EditarMovimentacaoDialog.tsx` (default ao abrir).
- Sem mudanças de schema, sem trigger, sem alteração nos períodos 20-25 e 25-30.
