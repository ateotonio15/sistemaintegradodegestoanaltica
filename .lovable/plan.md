## Objetivo

Garantir, no frontend e no backend, que o perfil **Cadastro** (`comum`) só executa cadastro/anexos/alertas, e o perfil **Financeiro** detém a operação de notas e cobranças.

## Matriz de permissões

| Ação | Cadastro (`comum`) | Financeiro (`financeiro`) |
|---|---|---|
| Criar/editar empresas | Permitido | Bloqueado |
| Anexar docs em movimentação | Permitido | Permitido |
| Disparar alerta (Pendente → Enviado) | Permitido | — |
| Ver status próprio | Permitido | Permitido |
| Envio Nota (`data_envio_nota`) | Bloqueado | Permitido |
| Tipo cobrança / vencimento / responsável / observações financeiras | Bloqueado | Permitido |
| Aprovar / atualizar status financeiro | Bloqueado | Permitido |
| Registrar cobranças | Bloqueado | Permitido |

## Ajustes Frontend

1. **`src/pages/Movimentacoes.tsx`**
   - Esconder coluna/badge "Nota Enviada" como editável para `comum`; manter apenas leitura.
   - Garantir que ações que escrevem em `financeiro_movimentacoes` (ex.: marcar nota enviada, editar tipo cobrança) sejam ocultas se `role === "comum"`.

2. **`src/components/financeiro/*`** (`EditarMovimentacaoDialog`, `FinanceiroTable`, `CobrancaDialog`, `CobrancaBanner`)
   - Bloquear abertura/submit do `EditarMovimentacaoDialog` quando `!canManageFinanceiro` (já existe a flag em `Financeiro.tsx`; aplicar a mesma flag também onde o dialog é instanciado para `comum`).
   - `CobrancaBanner` para `comum`: somente leitura (sem ações de resolver/registrar).

3. **`src/pages/Dashboard.tsx`**
   - Já oculta colunas via `role === "comum"`; reforçar que botões de ação financeira (registrar nota, editar) não apareçam para `comum`.

4. **`src/components/AppLayout.tsx`**
   - Manter rota `/financeiro` indisponível para `comum` (já restrito a `financeiroOrAdmin`); confirmar redirect.

5. Centralizar flags em `useAuth`:
   - Adicionar `isComum` derivada de `role === "comum"`.
   - Adicionar helper `canEditFinanceiro = isAdmin || isFinanceiro` para uso unificado.

## Ajustes Backend (Migrations)

Reforço de RLS para impedir que um cliente malicioso burle o frontend:

1. **`financeiro_movimentacoes`**
   - Hoje: `Authenticated read` (OK), apenas `admin`/`financeiro` podem manage. ✅ já correto. Sem mudanças.

2. **`anexos_financeiro`**
   - Hoje: `comum` não tem INSERT/UPDATE/DELETE direto (só admin/financeiro). ✅ já correto. Os anexos do `comum` são espelhados via trigger `handle_envio_financeiro` (SECURITY DEFINER). Sem mudanças.

3. **`cobrancas`**
   - Hoje: apenas admin/financeiro podem manage. ✅ já correto.

4. **`alertas_financeiro`**
   - Hoje: SELECT/manage só para admin/financeiro; criação ocorre via trigger SECURITY DEFINER quando `comum` atualiza `data_envio_financeiro`. ✅ correto.

5. **`movimentacoes` (reforço)**
   - Adicionar política/trigger para impedir que `comum` altere campos financeiros sensíveis. Hoje a policy "Comum user update movimentacoes" permite UPDATE em qualquer coluna. Criar trigger `BEFORE UPDATE` que, se `has_role(auth.uid(),'comum')`, bloqueia mudanças em colunas reservadas (`tipo_cobranca` não existe nesta tabela; o foco é manter `data_envio_financeiro` apenas indo de NULL → data, sem rollback, e impedir edição de `dentro_prazo`).
   - Trigger:
     ```sql
     create or replace function public.guard_movimentacoes_comum()
     returns trigger language plpgsql security definer set search_path=public as $$
     begin
       if has_role(auth.uid(),'comum') then
         if old.data_envio_financeiro is not null
            and new.data_envio_financeiro is distinct from old.data_envio_financeiro then
           raise exception 'Cadastro não pode alterar envio ao financeiro já registrado';
         end if;
         new.dentro_prazo := old.dentro_prazo;
       end if;
       return new;
     end$$;
     create trigger trg_guard_mov_comum
       before update on public.movimentacoes
       for each row execute function public.guard_movimentacoes_comum();
     ```

## Arquivos a alterar

- `src/hooks/useAuth.tsx` — adicionar `isComum` e `canEditFinanceiro`.
- `src/pages/Movimentacoes.tsx` — gating de UI financeira.
- `src/pages/Dashboard.tsx` — gating fino em ações.
- `src/components/financeiro/EditarMovimentacaoDialog.tsx` — bloquear submit p/ `comum`.
- `src/components/financeiro/CobrancaBanner.tsx` — modo leitura p/ `comum`.
- Migration nova — função + trigger `guard_movimentacoes_comum`.

## Resultado esperado

- Cadastro vê apenas o que pode operar; tentativas de POST/UPDATE em campos financeiros falham no banco mesmo se a UI for contornada.
- Financeiro mantém fluxo atual sem regressão.