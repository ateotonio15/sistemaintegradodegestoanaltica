## Objetivo

Adicionar três funcionalidades **isoladas na aba Financeiro** (`/financeiro`), sem afetar Cadastro/Operacional/Comercial:

1. Coluna e campo **"Emissão"** (dia 01–31)
2. Vencimento exibido **apenas como dia (DD)**
3. **Controle de prazo** (24h / 48h / regra dia 01) ao status "Aguardando nota", com gráfico Dentro/Fora do prazo

---

## 1. Coluna e Campo "Emissão"

### Banco
- Nova coluna `dia_emissao` (smallint, nullable, 1–31) em `financeiro_movimentacoes`.
- Trigger `BEFORE INSERT` que preenche automaticamente `dia_emissao = 1` quando `periodo IN ('20-25','25-30')` e o campo vier nulo.
- Backfill: `UPDATE financeiro_movimentacoes SET dia_emissao = 1 WHERE dia_emissao IS NULL AND periodo IN ('20-25','25-30')`.

### Frontend (somente Financeiro)
- **Tabela** (`FinanceiroTable.tsx`): nova coluna **"Emissão"** entre **Tipo** e **Status**, exibindo `Emissão dia XX` (ou `—`).
- **Editar movimentação** (`EditarMovimentacaoDialog.tsx`): novo `<Select>` "Dia de emissão (01–31)" logo abaixo de "Data de envio da nota". Salva `dia_emissao`.

---

## 2. Vencimento somente DD na aba Financeiro

- Em `FinanceiroTable.tsx`, alterar a célula **Vencimento** para mostrar apenas `String(getDate()).padStart(2,'0')` (helper local `formatDay` já existe em `date-utils.ts`).
- Banco intacto. Outras telas continuam exibindo data completa.

---

## 3. Regras de Prazo (24h/48h + dia 01)

### Banco
- Nova coluna `aguardando_nota_em` (timestamptz, nullable) em `financeiro_movimentacoes` — marca quando o registro entrou em "Aguardando nota".
- Trigger `BEFORE UPDATE` em `financeiro_movimentacoes`:
  - Quando o status calculado passa a ser "Aguardando nota" (heurística servidor: `data_envio_nota IS NULL` e detecção via flag aplicação) → como o status é calculado no front, **gravamos `aguardando_nota_em` via app** quando o usuário do Operacional clicar em "Pendente → enviar" (já existe `data_envio_financeiro` em `movimentacoes`). Estratégia mais simples e sem tocar em outros fluxos: marcar `aguardando_nota_em = now()` no momento em que existir registro em `movimentacoes` com `data_envio_financeiro` e a `financeiro_movimentacoes` correspondente ainda não tem nem `data_envio_nota` nem `aguardando_nota_em`. Implementação via **trigger AFTER UPDATE em `movimentacoes`** quando `data_envio_financeiro` passa de NULL para preenchida → faz `UPDATE financeiro_movimentacoes SET aguardando_nota_em = now() WHERE empresa_id=… AND mes_referencia=… AND periodo=… AND aguardando_nota_em IS NULL AND data_envio_nota IS NULL`. Fica **isolado ao Financeiro** (só popula coluna do Financeiro).

### Cálculo do prazo (frontend, em `lib/financeiro-utils.ts`)
Função `calcularPrazoFinanceiro({ aguardando_nota_em, data_envio_nota, dia_emissao })`:
1. Se `aguardando_nota_em` ausente → `"sem-base"` (ignorado nos KPIs de prazo).
2. Definir `inicio`:
   - Se `dia_emissao = 1` → `inicio = primeiro dia do MÊS SEGUINTE` ao `aguardando_nota_em` (00:00 local).
   - Caso contrário → `inicio = aguardando_nota_em`.
3. Janela:
   - `inicio.getDate() <= 10` → 48h.
   - `inicio.getDate() >= 11` → 24h.
4. `limite = inicio + janela`.
5. Comparar com `data_envio_nota` (ou `now()` se ainda pendente):
   - Enviada `<= limite` → **Dentro do prazo**.
   - Enviada `> limite` ou pendente após `limite` → **Fora do prazo**.
   - Pendente antes de `inicio` ou dentro da janela → **Em andamento** (não conta no gráfico).

### Gráfico (`StatusChart.tsx`)
Modo **"Prazo"** passa a usar `calcularPrazoFinanceiro` (em vez de `dentro_prazo` boolean). Categorias:
- 🟢 Dentro do prazo
- 🔴 Fora do prazo
- ⚪ Em andamento (cinza, opcional para diagnóstico)

### KPI
Card "Fora do prazo" passa a contar pelo cálculo novo, em vez de `dentro_prazo === false && !data_envio_nota`.

---

## Detalhes técnicos

**Arquivos editados**
- `supabase/migrations/<timestamp>_financeiro_emissao_e_prazo.sql` (nova)
- `src/lib/financeiro-utils.ts` (helper `calcularPrazoFinanceiro`, tipo `PrazoCategoria`)
- `src/components/financeiro/FinanceiroTable.tsx` (nova coluna + Vencimento DD; `COL_COUNT` 12 → 13)
- `src/components/financeiro/EditarMovimentacaoDialog.tsx` (campo Dia de emissão)
- `src/components/financeiro/StatusChart.tsx` (modo prazo recalculado)
- `src/components/financeiro/KpiCards.tsx` + `src/pages/Financeiro.tsx` (cálculo prazo)
- `src/pages/Financeiro.tsx` (incluir `dia_emissao`/`aguardando_nota_em` no select e em `FinanceiroRow`)

**Isolamento garantido**
- Todas as mudanças de schema são em `financeiro_movimentacoes` (tabela exclusiva do Financeiro).
- Trigger em `movimentacoes` apenas LÊ a movimentação operacional e ESCREVE em `financeiro_movimentacoes`; não muda comportamento do Operacional/Cadastro.
- `formatDay` apenas dentro de `FinanceiroTable.tsx`. Outras tabelas (`Movimentacoes.tsx`, Dashboard, etc.) continuam com `formatDateBR`.

**Memória**
- Atualizar `mem://auth/profile-permissions-cadastro-financeiro` registrando os novos campos exclusivos do Financeiro.
- Criar `mem://logic/financeiro-prazo-emissao` com a regra de cálculo (24h/48h, dia 01 → começa no mês seguinte).
