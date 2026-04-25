## 🎯 Objetivo
Adicionar botão **"Exportar Excel"** na aba **Financeiro** que gera um arquivo `.xlsx` contendo apenas as linhas atualmente visíveis (respeitando todos os filtros ativos), com colunas idênticas à tabela exibida e linha de **totais** no rodapé.

---

## 📋 Escopo

### 1. Botão de Exportação (`src/pages/Financeiro.tsx`)
- Novo botão **"Exportar Excel"** com ícone `Download`, posicionado no header ao lado de **"Gerar movimentações"** e do seletor de **Mês**.
- Estado local `isExporting` controla:
  - Spinner no ícone (`animate-spin`)
  - `disabled` durante a geração
  - Texto muda para `"Exportando..."`
- **Permissão**: visível apenas quando `canManageFinanceiro` (Admin ou Financeiro) — ou seja, herda o mesmo guard que já protege a página, então qualquer usuário com acesso à aba pode exportar.

### 2. Lógica de Exportação
Usar a biblioteca **`xlsx`** (já instalada — `^0.18.5`).

**Fonte dos dados**: `filteredRows` (variável existente que já aplica todos os filtros ativos: busca, status, tipo, período, "apenas fora do prazo").

**Colunas exportadas** (idênticas às visíveis na `FinanceiroTable`):
| # | Coluna | Origem |
|---|--------|--------|
| 1 | Empresa | `empresa_nome` |
| 2 | Contrato | `empresa_codigo` |
| 3 | CNPJ | `empresa_cnpj` |
| 4 | Responsável | `responsavel` |
| 5 | Tipo | `tipo_cobranca` |
| 6 | Status | `status` (calculado) |
| 7 | Envio nota | `data_envio_nota` (formatado pt-BR) |
| 8 | Vencimento | `data_vencimento` (formatado pt-BR) |
| 9 | Anexos | `anexos_count` (numérico) |
| 10 | Cobrança registrada | `"Sim" / "Não"` |

**Linha de totais (rodapé)**:
- Coluna 1: `"TOTAL"`
- Coluna 6 (Status): contagens consolidadas → `"Enviadas: X | Aguardando: Y | Pendentes: Z | Fora do prazo: W"`
- Coluna 9 (Anexos): soma total de anexos
- Coluna 10: total de cobranças registradas

**Formatação**:
- Larguras de coluna ajustadas (`!cols`) para boa leitura
- Cabeçalho em negrito (via merge ou estilo simples)
- Nome da aba: `Financeiro`
- Nome do arquivo: `financeiro_<mes>_<YYYYMMDD>.xlsx` (ex: `financeiro_2026-04_20260425.xlsx`)

### 3. UX
- **Loading**: spinner no botão + estado disabled
- **Sucesso**: `toast.success("Arquivo exportado: X registros")` com a contagem
- **Vazio**: se `filteredRows.length === 0` → `toast.warning("Nenhum registro para exportar com os filtros atuais")` e aborta
- **Erro**: `toast.error("Erro ao exportar: <mensagem>")`

### 4. Permissão
- A página `Financeiro.tsx` já bloqueia acesso via `Navigate to="/"` para quem não é `canManageFinanceiro`
- O botão só renderiza se essa condição for verdadeira (já garantido pelo guard da página)
- Não requer mudanças de RLS — exportação acontece 100% no client a partir de dados já carregados

---

## 📂 Arquivos afetados
- ✏️ **`src/pages/Financeiro.tsx`** — adicionar botão, função `handleExport`, importar `xlsx` e ícone `Download`

## 🚫 Fora do escopo
- Não exporta KPIs/gráficos (apenas a tabela)
- Não inclui anexos (apenas a contagem numérica)
- Não usa edge function (geração 100% client-side, suficiente para o volume típico)
