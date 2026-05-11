## Nova Aba "Reajuste" - Controle Anual de Reajustes Contratuais

### Contexto importante
Já existe uma tabela `reajustes` em uso pelo módulo Financeiro (com campos `valor_centavos`, `competencia`, `parcelas`, `aporte`...). Para não quebrar essa funcionalidade existente, criarei uma **nova tabela separada** `reajustes_anuais` dedicada ao controle anual contratual.

### 1. Banco de Dados (migration)

Nova tabela `public.reajustes_anuais`:
- `id` uuid PK
- `empresa_id` uuid NOT NULL (vínculo obrigatório com contrato)
- `ano` integer NOT NULL
- `valor_antigo_centavos` bigint NOT NULL
- `percentual` numeric(6,2) NOT NULL
- `valor_reajustado_centavos` bigint NOT NULL (calculado)
- `data_aplicacao` date NOT NULL
- `observacao` text
- `status` text DEFAULT 'Reajustado' (Pendente / Reajustado / Atrasado)
- `usuario_id` uuid (responsável)
- `created_at`, `updated_at`
- UNIQUE (empresa_id, ano) — evita duplicidade no mesmo ano

RLS:
- SELECT: todos autenticados
- INSERT/UPDATE/DELETE: apenas `admin` e perfil `visualizacao` (conforme solicitação literal)
- Trigger `updated_at`

### 2. Frontend

**Nova rota** `/reajustes` + item no menu lateral (`AppLayout`).

**Página `src/pages/Reajustes.tsx`:**
- Filtros: ano (default = ano atual), busca por empresa, filtro de status
- KPI cards: Total de contratos, Reajustados no ano, Pendentes, Atrasados
- **Alerta visual** no topo: "X contratos pendentes de reajuste anual" (lista expansível)
- **Tabela principal** (uma linha por empresa ativa):
  - Empresa | Contrato | Último reajuste (ano) | Valor atual | % | Valor reajustado | Data | Status | Ações
  - Status badge: Pendente (amarelo), Reajustado (verde), Atrasado (vermelho)
- **Dialog "Novo/Editar Reajuste"**:
  - Empresa (select), Ano, Valor atual (R$), Percentual (%), Valor reajustado (auto, readonly, atualiza onChange), Data aplicação, Observação
  - Cálculo: `valor_atual + (valor_atual * percentual / 100)` em tempo real
- **Histórico por empresa**: dialog mostrando todos os reajustes anteriores (ano, %, valor antigo→novo, usuário, data)

**Permissões UI** (gates):
- Botões "Novo", "Editar", "Excluir" só visíveis para `isAdmin || isViewOnly` (perfil Visualização)
- Demais perfis veem tudo em modo leitura

### 3. Alertas globais

**Dashboard** (`src/pages/Dashboard.tsx`): card/banner "Reajustes pendentes — N contratos sem reajuste no ano atual" com link para `/reajustes`.

**Lista de contratos** (`src/pages/Empresas.tsx`): badge amarela "Reajuste pendente" na linha quando empresa ativa não tem reajuste no ano corrente.

Lógica: empresa ativa sem registro em `reajustes_anuais` para `ano = ano atual` → pendente. Se data atual já passou da `data_implantacao + 1 ano` sem reajuste → atrasado.

### 4. Detalhes técnicos
- Valores armazenados em centavos (bigint) para evitar float
- Cálculo automático no formulário via `useEffect` ou onChange direto
- React Query: keys `reajustes-anuais`, `reajustes-anuais-pendentes`
- Util `src/lib/reajuste-utils.ts` com `calcularValorReajustado(valor, pct)` e `getStatusReajuste(empresa, reajustes, ano)`

### Arquivos a criar/editar
- **migration**: nova tabela + RLS
- **criar**: `src/pages/Reajustes.tsx`, `src/components/reajustes/ReajusteDialog.tsx`, `src/components/reajustes/ReajusteHistoricoDialog.tsx`, `src/components/reajustes/AlertaReajustesPendentes.tsx`, `src/lib/reajuste-utils.ts`
- **editar**: `src/App.tsx` (rota), `src/components/AppLayout.tsx` (menu), `src/pages/Dashboard.tsx` (alerta), `src/pages/Empresas.tsx` (badge)

### Confirmação necessária
A spec diz **"Somente perfil Visualização pode criar/editar/excluir"**. Isso é incomum (Visualização normalmente é read-only). Vou implementar exatamente assim + permitir Admin também (que tem acesso total a tudo no sistema). Confirme se está correto antes de eu executar.