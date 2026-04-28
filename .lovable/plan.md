## Objetivo

Permitir que o **Cadastro responsável pela empresa** (e Admin) **exclua** a `data_envio_financeiro` de uma movimentação já enviada, removendo também o alerta correspondente do Financeiro.

## Regras

- **Quem pode**: Admin sempre; Cadastro apenas se for `responsavel_user_id` da empresa OU vinculado em `empresa_usuarios`.
- **Sem trava de segurança extra**: pode apagar mesmo que Financeiro já tenha registrado nota/vencimento (a UI pedirá confirmação).
- **Efeito colateral**: o alerta de `tipo='vencimento'` ligado àquela movimentação é **excluído** (DELETE) — não fica nem como cancelado.
- Não altera anexos, `dentro_prazo`, nem outros campos.

## Backend

1. **Ajustar `guard_movimentacoes_comum`**:
   - Permitir `NEW.data_envio_financeiro IS NULL` quando o Cadastro é responsável/vinculado (hoje bloqueia com "Data não pode ser removida").
   - Manter as demais validações (autorização, data não futura quando definida).

2. **Novo trigger `trg_remove_alerta_vencimento_on_unset`** (AFTER UPDATE OF `data_envio_financeiro`):
   - Quando `OLD.data_envio_financeiro IS NOT NULL` e `NEW.data_envio_financeiro IS NULL`, executar `DELETE FROM alertas_financeiro WHERE movimentacao_id = NEW.id AND tipo = 'vencimento'`.
   - O trigger existente `trg_sync_alerta_data_envio` continua cuidando da sincronização quando a data é apenas trocada.

## Frontend

A UI atual (formulários em `Dashboard.tsx` e `pages/Movimentacoes.tsx`) já expõe o campo como `<Input type="date">`, então limpar o campo já dispara `data_envio_financeiro: null`. Acrescentar:

1. **Botão "Limpar" / ícone X** ao lado do input em ambos os formulários (apenas se valor preenchido e usuário autorizado).
2. **Confirmação** (`AlertDialog`) ao limpar com texto: "Isso removerá o alerta enviado ao Financeiro. Deseja continuar?".
3. **Toast de sucesso**: "Envio ao Financeiro removido".
4. **Invalidação React Query**: `["movimentacoes"]`, `["faturamentos-fin-pendentes"]`, `["alertas_financeiro"]`, `["financeiro"]`.

## Memória

Atualizar `mem://auth/profile-permissions-cadastro-financeiro`: Cadastro responsável agora pode trocar **e excluir** `data_envio_financeiro`; ao excluir, o alerta de vencimento é removido pelo trigger `trg_remove_alerta_vencimento_on_unset`.
