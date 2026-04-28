## Objetivo

No card **Faturamentos Não Enviados** (dashboard do Cadastro/Admin), adicionar um botão por linha que dispara um alerta para o Financeiro. Esse alerta aparece automaticamente no card **Notas a Enviar** (`FaturamentosEnviadoFinanceiro`) do dashboard do Financeiro. O botão só aparece enquanto não houver alerta Pendente para aquela movimentação; quando o Financeiro preencher `data_envio_nota`, o alerta é finalizado pelo trigger existente e o botão volta a ficar disponível (mas a linha sai da lista, pois deixa de ser "não enviado").

## Comportamento

- Card Faturamentos Não Enviados (perfil **Cadastro** e **Admin**):
  - Cada linha ganha à direita, antes do badge "Aguardando nota":
    - Botão `Alertar Financeiro` (ícone sino) — quando ainda não há alerta Pendente.
    - Badge `Alerta enviado` (estilo info, ícone check) — quando já existe alerta Pendente do tipo `nota` para aquela movimentação.
  - Ao clicar:
    1. Resolve a `movimentacao` operacional correspondente (mesma `empresa_id` + `mes_referencia` + `periodo`). Se não existir, cria uma mínima (insert em `movimentacoes`).
    2. Faz `upsert` em `alertas_financeiro` com `tipo='nota'`, `status='Pendente'`, `data_envio = hoje`, `enviado_por_user_id = auth.uid()`, `enviado_por_nome = profile.display_name`, `empresa_id`, `empresa_nome`.
    3. Toast de sucesso "Financeiro alertado".
  - Realtime já existente em `alertas_financeiro` no card do Financeiro garante atualização imediata.

- Card Notas a Enviar (Financeiro): nenhuma alteração — já lê `alertas_financeiro` com `tipo='nota'` (ou null) e status Pendente.

## Implementação técnica

1. **DB (migration)** — função RPC `alertar_financeiro_nota(p_empresa_id uuid, p_mes_referencia text, p_periodo text)`:
   - `SECURITY DEFINER`, `search_path=public`.
   - Autoriza se `has_role(auth.uid(),'admin')` OU (`has_role(auth.uid(),'comum')` E usuário vinculado à empresa via `empresas.responsavel_user_id` ou `empresa_usuarios`).
   - Garante registro em `movimentacoes` (cria se não existir) e devolve `mov_id`.
   - `INSERT ... ON CONFLICT (movimentacao_id, tipo) DO UPDATE` em `alertas_financeiro` com `tipo='nota'`, `status='Pendente'`, `finalizado_em=NULL`, `data_envio=CURRENT_DATE`.
   - Retorna o `id` do alerta.
   - Garantir índice/constraint único `(movimentacao_id, tipo)` (já é exigido pelo `enviar_movimentacao_ao_financeiro`, manter compatível).

2. **Frontend — `FaturamentosEnviadosCard.tsx`**:
   - Nova query `alertas-nota-pendentes-por-empresa-mes` que busca em `alertas_financeiro` os alertas Pendentes de `tipo='nota'` (ou null) cruzando com as `movimentacoes` (empresa+mes+periodo) para saber quais linhas já têm alerta. Usa um Map `${empresa_id}|${mes}|${periodo}` → boolean.
   - Estende `Linha` com `temAlertaPendente: boolean`.
   - Renderiza `Button` (variant outline, size sm, ícone `BellRing`) ou Badge `Alerta enviado` (variant outline verde) conforme estado.
   - `useMutation` chamando `supabase.rpc('alertar_financeiro_nota', { p_empresa_id, p_mes_referencia, p_periodo })`, com toast e `invalidateQueries` do próprio card.
   - Realtime adicional escutando `alertas_financeiro` para atualizar o estado do botão.
   - Permitido apenas se `isComum || isAdmin` (vindo de `useAuth`).

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — função RPC `alertar_financeiro_nota`.
- `src/components/dashboard/FaturamentosEnviadosCard.tsx` — UI do botão, query de alertas existentes, mutation e realtime.

## Fora de escopo

- Nenhuma alteração no card do Financeiro (`FaturamentosEnviadoFinanceiro.tsx`) nem no fluxo de alerta de vencimento.
