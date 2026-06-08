## Módulo Honda Exclusões

Novo módulo dedicado ao acompanhamento antecipado de desligamentos programados de beneficiários da empresa Honda, restrito ao responsável Honda, Diretora e Admin.

### 1. Banco de dados (Lovable Cloud)

Nova tabela `honda_exclusoes`:
- `nome_beneficiario` (text)
- `cpf` (text, 11 dígitos)
- `data_demissao` (date)
- `motivo` (text)
- `tipo_operacao` (text)
- `sequencia` (text)
- `importado_por` (uuid → auth.users)
- `importado_em` (timestamptz default now())
- `concluido` (boolean default false) — marcação manual ou automática pós-data
- standard `id`, `created_at`, `updated_at`

RLS:
- SELECT/INSERT/UPDATE permitidos para `admin`, `diretora` e para o responsável vinculado à empresa Honda (via `empresa_usuarios` + lookup da empresa cujo nome contém "HONDA").
- DELETE bloqueado para todos exceto `admin` (preservação de histórico).
- GRANT a `authenticated` e `service_role`.

Função SECURITY DEFINER `can_access_honda_exclusoes(_user_id uuid)` retornando boolean, usada nas policies e no frontend (via RPC) para liberar/ocultar a aba.

### 2. Permissões e navegação

- `useAuth` ganha flag derivada `canAccessHondaExclusoes` que consulta `can_access_honda_exclusoes` via RPC (cacheado em React Query).
- `AppLayout` / sidebar mostra item "Honda Exclusões" (ícone 🏍️ Bike do lucide) somente se `canAccessHondaExclusoes`.
- `RoleGate` customizado para a rota `/honda-exclusoes` baseado nessa flag (admin, diretora ou responsável Honda).

### 3. Estrutura da página `/honda-exclusoes`

Página `src/pages/HondaExclusoes.tsx` com `Tabs` shadcn:
- **Dashboard** — KPI cards: Programadas, Mês, Semana, Amanhã, Vencidas (não concluídas). Pequeno gráfico de barras por mês.
- **Importação** — botão "Importar Arquivo" abrindo dialog que aceita `.xlsx` e `.csv`. Parser dedicado em `src/lib/honda-exclusoes-import.ts` lendo as 6 colunas; valida CPF (11 dígitos) e Data Demissão; pula linhas inválidas/vazias e exibe relatório de erros antes de confirmar o insert em lote.
- **Exclusões Futuras** — tabela de registros com `data_demissao >= hoje` e não concluídos.
- **Exclusões do Dia** — tabela com `data_demissao = hoje`.
- **Histórico** — tabela completa com filtros (Mês, Ano, Status, Motivo, CPF, Nome) e busca rápida CPF/Nome.

Colunas padrão: Nome, CPF, Data Demissão, Motivo, Dias Restantes, Status.

Status calculado em runtime:
- `Concluído` se `concluido = true` ou data passou e foi marcada.
- `Hoje` se data = hoje.
- `Amanhã` se data = hoje+1.
- `Atrasado` se data < hoje e não concluído.
- `Programado` caso contrário.

### 4. Alertas automáticos

- Hook `useHondaAlertas` consulta exclusões com `data_demissao` entre hoje e amanhã (inclusive) e não concluídas.
- Alerta aparece a partir de D-1 00:00 e permanece visível até 23:59 da data de demissão (filtro no client por horário local).
- Banner global no topo do Dashboard do responsável Honda (e admin/diretora) com lista resumida (Nome, CPF, Data, Motivo).
- Card "Exclusões Honda" no `Dashboard` (e `DashboardFinanceiro` quando aplicável) mostrando contadores Amanhã / Hoje / Atrasadas com link para a aba.

### 5. Animação Honda (moto)

Componente `HondaMotoProgress` (CSS/Tailwind puro, sem libs):
- Linha horizontal com 🏍️ avançando em direção a 📍.
- Posição calculada por `diasRestantes`: mais perto do destino conforme a data se aproxima (ex.: 100% em D-0, 75% em D-1, etc.).
- Animação suave (`transition-all duration-700`) e respeitando `prefers-reduced-motion`.
- Exibido no header da aba e ao lado de cada linha "Amanhã/Hoje" das tabelas. Cores derivadas dos tokens existentes (dark green/primary), compatível com tema escuro.

### 6. Integrações

- Link para empresa Honda em `Empresas` (badge "Honda Exclusões" quando há programadas).
- Card resumo no `Dashboard`.
- Lançamento opcional em `Movimentações` é deixado de fora (apenas leitura cruzada — sem exclusão automática).
- `Gestão de Vidas`: contador de exclusões Honda futuras exibido no painel da Honda.

### 7. Arquivos a criar/editar

Novos:
- `supabase/migrations/<timestamp>_honda_exclusoes.sql` (tabela + RLS + função `can_access_honda_exclusoes`).
- `src/pages/HondaExclusoes.tsx`
- `src/components/honda/ImportarHondaDialog.tsx`
- `src/components/honda/HondaMotoProgress.tsx`
- `src/components/honda/HondaAlertasBanner.tsx`
- `src/components/honda/HondaExclusoesCard.tsx` (card para dashboards)
- `src/hooks/useHondaExclusoes.ts`
- `src/hooks/useHondaAlertas.ts`
- `src/lib/honda-exclusoes-import.ts` (parser xlsx + csv, valida CPF/data)

Editados:
- `src/App.tsx` — rota `/honda-exclusoes` com gate por flag.
- `src/components/AppLayout.tsx` — item de menu condicional.
- `src/hooks/useAuth.tsx` — flag `canAccessHondaExclusoes`.
- `src/pages/Dashboard.tsx` (e dashboards relevantes) — incorpora `HondaAlertasBanner` e `HondaExclusoesCard`.

### 8. Garantias

- Nenhuma exclusão automática de beneficiários — módulo é apenas informativo.
- Histórico não é apagado (sem DELETE no client).
- Aba e dados ocultos para perfis sem permissão (RLS + gate de rota + sidebar condicional).
- Alertas só somem após 23:59 local da data de demissão.
- Importações ficam registradas com `importado_por` e `importado_em`.

### Pergunta antes de implementar

1. Qual é a empresa exata que representa a "Honda" no cadastro (nome ou contrato) para vincular o responsável? Posso usar `ILIKE '%HONDA%'` na tabela `empresas` ou prefere um contrato específico (ex.: contrato Honda Componentes vs Moto Honda)?
2. O "Responsável da empresa Honda" deve ser todo usuário ligado via `empresa_usuarios` à empresa Honda, ou somente o usuário marcado como responsável principal/executivo?
