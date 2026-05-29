## Padronizar "Data de vencimento (dia)" no diálogo Editar movimentação

Arquivo: `src/components/financeiro/EditarMovimentacaoDialog.tsx` (linhas 656–669)

- Substituir o `<Select>` atual (01–31 com "— Não definido —") pelo componente `DayGridPicker` já existente (`src/components/ui/day-grid-picker.tsx`), no mesmo padrão usado em "Dia de emissão" e nos campos do diálogo de Configuração Financeira.
- Conversão de estado:
  - `diaVencimento` (string) continua sendo persistido como hoje.
  - O picker trabalha com `number | null`; converter para/de string ao ler/escrever no estado (`__none__` deixa de existir, vira `null`).
- Preservar o label "Data de vencimento (dia)" e o helper "Apenas o dia (01–31) do vencimento no Financeiro."
- Nenhuma mudança em validações, salvamento, RPC, schema ou lógica de prazo.

### Fora do escopo
- Nenhuma alteração em outros campos, telas, banco ou regras de negócio.
