## Objetivo

Permitir que o perfil **Cadastro responsável pela empresa** (e Admin) altere a `data_envio_financeiro` de uma movimentação já enviada, refletindo a alteração também no alerta correspondente do Financeiro.

## Regras de negócio

- **Quem pode editar**: Admin sempre; Cadastro apenas se for `responsavel_user_id` da empresa OU vinculado em `empresa_usuarios`.
- **Validação da data**: obrigatória, não pode ser futura (`<= hoje`).
- **Efeito colateral**: atualizar `alertas_financeiro.data_envio` do alerta `tipo='vencimento'` ligado à mesma `movimentacao_id`, mantendo status atual (não reabre nem finaliza).
- Não altera anexos nem outros campos.

## Backend

1. **Nova RPC** `public.atualizar_data_envio_financeiro(p_mov_id uuid, p_nova_data date)`:
   - `SECURITY DEFINER`, valida `auth.uid()`.
   - Checa autorização: admin OR (cadastro AND (responsável da empresa OR vinculado em `empresa_usuarios`)).
   - Valida `p_nova_data <= CURRENT_DATE` e não nula.
   - Exige que a movimentação já tenha `data_envio_financeiro` preenchida (só "trocar", não criar).
   - `UPDATE movimentacoes SET data_envio_financeiro = p_nova_data, updated_at = now()`.
   - `UPDATE alertas_financeiro SET data_envio = p_nova_data, updated_at = now() WHERE movimentacao_id = p_mov_id AND tipo = 'vencimento'`.
2. **Ajuste no trigger `guard_movimentacoes_comum`**: continua bloqueando UPDATE direto pelo Cadastro; a alteração legítima passa pela RPC (que roda como SECURITY DEFINER e não dispara o bloqueio para o Cadastro).

## Frontend

1. **Card "Faturamentos Enviados" (Dashboard Cadastro)** — `FaturamentosEnviadosCard.tsx`:
   - Adicionar ícone "Editar data" (lápis/calendário) ao lado da data exibida em cada linha.
   - Visível apenas para Admin ou Cadastro autorizado para aquela empresa.
   - Abre um pequeno dialog com `<Input type="date" max={hoje}>` e botão Salvar.
2. **Tela de Movimentações** — `EditarMovimentacaoDialog` (ou diálogo equivalente do Cadastro):
   - Tornar o campo "Data de envio ao Financeiro" editável quando o usuário tem permissão.
   - Mesmas validações; ao salvar, chamar a mesma RPC em vez do UPDATE direto.
3. **Hook utilitário** `useCanEditDataEnvioFinanceiro(empresaId)` para decidir exibição do controle (consulta role + vínculo).
4. **Invalidação React Query** após sucesso: `["movimentacoes"]`, `["faturamentos-enviados"]`, `["alertas_financeiro"]`, `["financeiro"]`.

## UX

- Toast de sucesso "Data de envio atualizada".
- Mensagem de erro clara se RPC retornar exceção (sem permissão / data futura).
- Tooltip no ícone: "Alterar data de envio ao Financeiro".

## Memória

Atualizar `mem://auth/profile-permissions-cadastro-financeiro` registrando que Cadastro responsável pode trocar `data_envio_financeiro` via RPC, e o alerta de vencimento é atualizado em conjunto.
