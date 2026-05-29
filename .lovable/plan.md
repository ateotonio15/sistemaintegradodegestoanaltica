## Ajustes no diálogo "Editar movimentação"

Padronizar dois campos da aba Financeiro → Editar movimentação para o novo visual de grade já usado em "Data de emissão" / "Data vencimento" do diálogo de Configuração Financeira.

### 1. Campo "Dia de emissão"

Arquivo: `src/components/financeiro/EditarMovimentacaoDialog.tsx` (linhas 564–582)

- Trocar o `<Select>` atual (lista de 01–31 com item "Não definido") pelo componente `DayGridPicker` (`src/components/ui/day-grid-picker.tsx`) já criado.
- Mantém exatamente o mesmo comportamento de dados:
  - Continua salvando em `dia_emissao` como número (1–31) ou `null`.
  - O estado interno `diaEmissao` (string) passa a ser convertido a partir do número retornado pelo picker; `__none__` deixa de existir e vira `null`.
- Preservar o helper text atual: "Períodos 20-25 e 25-30 começam com 'Emissão dia 01' automaticamente."
- Sem alterações em lógica de salvamento, validações ou queries.

### 2. Campo "Data de envio da nota"

Arquivo: `src/components/financeiro/EditarMovimentacaoDialog.tsx` (linhas 538–560)

Esse campo continua sendo uma data completa (dia + mês + ano), então NÃO usa o `DayGridPicker` (que é só 01–31). Em vez disso, padronizar o visual substituindo o `<input type="date">` nativo por um `Popover` + componente `Calendar` do shadcn, que já tem o mesmo estilo "grade" das imagens enviadas (cabeçalho com mês/ano e navegação ↑ ↓, grid de dias, botão "Limpar"/"Hoje").

- Usar `@/components/ui/calendar` (já presente no projeto, baseado em react-day-picker) dentro de um `Popover`, no mesmo padrão visual do `DayGridPicker`:
  - Trigger: botão com ícone de calendário + data formatada em `pt-BR` (DD/MM/AAAA) ou placeholder "— Não definido —".
  - Conteúdo: `Calendar` com `locale={ptBR}`, `mode="single"`, navegação por mês/ano, `disabled={{ after: new Date() }}` para manter a regra de não permitir datas futuras.
  - Rodapé com botões "Limpar" (seta para `null`) e "Hoje" (atalho para a data atual).
- Mantém estado `dataEnvioNota` em formato ISO `YYYY-MM-DD` (igual hoje) — apenas a UI muda.
- Preservar as mensagens existentes:
  - Aviso amarelo "Data de envio não pode ser futura." quando `envioNoFuturo`.
  - Mensagem verde "Nota marcada como enviada." quando há valor.
  - Borda de aviso (`border-warning`) no trigger quando `envioNoFuturo`.

### Fora do escopo

- Nenhuma mudança no schema do banco, RPCs, RLS ou outras telas.
- Nenhuma alteração no cálculo de prazo (24h/48h) nem na lógica `aguardando_nota_em`.
- Nenhuma mudança no `DayGridPicker` já existente.

### Detalhes técnicos

- Imports a adicionar no `EditarMovimentacaoDialog.tsx`: `DayGridPicker`, `Popover/PopoverTrigger/PopoverContent`, `Calendar`, `ptBR` de `date-fns/locale`, `format` de `date-fns`, ícone `CalendarIcon` de `lucide-react`.
- Conversões de data ISO ↔ `Date` feitas com construção local (sem `new Date("YYYY-MM-DD")` puro) para respeitar a regra de timezone do projeto (`mem://tech/date-management`).