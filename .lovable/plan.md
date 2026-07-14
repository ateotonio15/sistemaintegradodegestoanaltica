# Plano: Cadastro de Empresa (admin_interno) + Portal da Empresa

## 1. Backend (migração)

**profiles**
- Adicionar coluna `must_change_password boolean not null default false`.

**Nenhuma nova tabela** — já temos `empresas`, `empresa_usuarios` (com `papel`), `contratos`, `movimentacao_financeira`. O "período de movimentação" já vive nas tabelas `movimentacoes` / `financeiro_*` do sistema atual, então o portal vai ler de lá.

**RLS complementares para portal admin_empresa**
Adicionar policies de SELECT em `empresas`, `contratos`, `movimentacoes`, `financeiro_movimentacoes` usando o helper `user_pode_ver_empresa(empresa_id)` já criado — assim admin_empresa enxerga só a própria empresa. (Policies existentes de admin/comum/financeiro permanecem.)

## 2. Edge Function `criar-empresa-com-acesso`

Recebe `{ nome, cnpj, valor_mensal, data_inicio, email }`. Fluxo com service role:

1. Valida chamador via `user_roles` = `admin_interno`.
2. `insert into empresas (nome, cnpj, ...)` → pega `empresa_id`.
3. `insert into contratos (empresa_id, valor_mensal, data_inicio, status='ativo')`.
4. Gera senha provisória aleatória (16 chars).
5. `auth.admin.createUser({ email, password, email_confirm: true })`.
6. `profiles.update({ must_change_password: true, display_name: nome })` para o novo user.
7. `insert into empresa_usuarios (user_id, empresa_id, papel='admin_empresa')`.
8. `insert into user_roles (user_id, role='comum')` (papel base) — visibilidade real vem de `empresa_usuarios.papel`.
9. Retorna `{ email, senha_provisoria }` para o admin copiar/entregar.

## 3. Frontend

**Nova rota `/admin/cadastrar-empresa`** (gate `admin_interno` via `user_roles`)
- Form: nome, CNPJ (mask), valor mensal, data início, e-mail.
- Ao salvar: chama a edge function, mostra dialog com e-mail + senha provisória e botão "Copiar".

**Gate de troca de senha**
- Em `AppShell`, após carregar sessão, buscar `profiles.must_change_password`. Se true, forçar redirect para `/trocar-senha` (rota nova, permite só logout + form nova senha). Ao salvar: `supabase.auth.updateUser({ password })` + `profiles.update({ must_change_password: false })`.

**Rota `/portal`** (para papel admin_empresa)
- Após login, se `empresa_usuarios` tem vínculo `admin_empresa`, redireciona `/` → `/portal`.
- Página única mostrando:
  - Card do contrato: valor, data início, status.
  - Card do período de movimentação atual (lê `movimentacoes` da empresa):
    - Se período aberto para empresa → "Movimentação liberada até DD/MM".
    - Se em análise financeira → "Aguardando emissão da nota pelo Financeiro. Movimentação bloqueada até liberação."
    - Se fechado → "Movimentação encerrada. Próxima janela a partir de DD/MM."
  - Lista das últimas movimentações da empresa (read-only).
- Menu lateral escondido para esse papel (layout limpo).

**Login `/auth`** — reutilizado, sem alteração.

## 4. Detalhes técnicos

- Helper `useIsAdminInterno()` lendo `user_roles.role='admin_interno'`.
- Helper `useEmpresaVinculada()` → primeiro registro de `empresa_usuarios` do user.
- Regra de redirect no `AppShell`:
  1. `must_change_password` → `/trocar-senha`
  2. papel `admin_empresa` (não admin_interno) em rota `/` → `/portal`
- Edge function isolada (não mexer em `create-user` existente).
- Senha provisória: `crypto.randomUUID().slice(0,16)` + garantia de 1 maiúscula/1 número.

## 5. Fora do escopo desta entrega

- Envio de e-mail com senha provisória (admin entrega manualmente por ora).
- Edição/remoção de empresa pelo portal.
- Detalhamento de vidas ativas no portal (pode entrar depois).
