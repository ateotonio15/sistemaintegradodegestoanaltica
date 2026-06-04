# Grupo Financeiro — Plano de Implementação

Funcionalidade nova que vincula múltiplos contratos/empresas em um mesmo grupo financeiro, compartilhando ações operacionais (anexos, envio de nota, DDA/depósito e vencimento), mantendo análises, histórico e tipo de cobrança individuais por contrato.

## 1. Banco de Dados (migration)

**Tabela `grupos_financeiros`**
- `id`, `nome_grupo` (único), `vencimento_compartilhado` (bool), `dia_vencimento` (1-31), `forma_pagamento_compartilhada` (bool), `forma_pagamento` ('DDA' | 'Depósito'), `observacao`, `status` ('Ativo' | 'Inativo')
- Auditoria: `criado_por_id/nome`, `atualizado_por_id/nome`, `created_at`, `updated_at`

**Tabela `grupos_financeiros_contratos`**
- `id`, `grupo_id` (FK), `empresa_id` (FK empresas), `codigo_contrato`, `nome_empresa`, `cnpj`, `ativo` (bool)
- Auditoria: `adicionado_por_id/nome`, `adicionado_em`, `removido_por_id/nome`, `removido_em`
- Constraint: índice único parcial `(empresa_id) WHERE ativo = true` — garante 1 grupo ativo por empresa.

**Tabela `grupos_financeiros_auditoria`**
- `id`, `grupo_id`, `acao`, `descricao`, `contrato_origem_id`, `contratos_impactados` (uuid[]), `usuario_id/nome`, `data_hora`, `dados_anteriores` (jsonb), `dados_novos` (jsonb)

**Alterações em tabelas existentes**
- `anexos_financeiro`: adicionar `grupo_id uuid null`, `compartilhado_grupo bool default false`, `contrato_origem_id uuid null` (movimentacao financeira original). Não duplica storage — anexos com `grupo_id` são visíveis a todas movimentações do grupo.

**Funções RPC (SECURITY DEFINER)**
- `aplicar_envio_nota_grupo(p_mov_id, p_data_envio, p_aplicar_grupo bool)` — replica `data_envio_nota` para todas movimentações financeiras do mesmo período das empresas do grupo.
- `aplicar_dda_grupo(p_mov_id, p_boleto_dda bool, p_pagamento_deposito bool)` — replica forma de pagamento em todo o grupo.
- `aplicar_vencimento_grupo(p_mov_id, p_data_vencimento)` — replica vencimento.
- `adicionar_contrato_grupo(p_grupo_id, p_empresa_id)` / `remover_contrato_grupo` — com validação de grupo único.
- Cada RPC registra entrada em `grupos_financeiros_auditoria`.

**RLS**
- `grupos_financeiros*`: SELECT para admin/financeiro/comum/administradoras/visualizacao/diretora; INSERT/UPDATE/DELETE apenas admin.
- GRANTs explícitos (anon: nenhum; authenticated: SELECT; admin via policies).

## 2. Frontend — aba Empresas

**Novo componente `GrupoFinanceiroSection.tsx`** dentro do dialog "Editar Empresa":
- Toggle: "Esta empresa pertence a um grupo financeiro?"
- Se Sim → Combobox "Selecionar grupo existente" + botão "Criar novo grupo"
- Dialog "Gerenciar Grupo" (admin-only): nome, vencimento compartilhado (switch + dia), forma de pagamento compartilhada (switch + DDA/Depósito), observação, status. Lista de contratos vinculados com remover, busca para adicionar.
- Validação: ao adicionar contrato já em outro grupo ativo → toast de erro com a mensagem padrão.
- Não-admin: read-only (visualização do grupo e contratos).

## 3. Frontend — aba Financeiro

**Tag de grupo na tabela** (`FinanceiroTable.tsx`): badge "Grupo: NOME" ao lado do nome da empresa (após Cobrança/Retroativo/DDA), variant `secondary`.

**Filtro "Grupo Financeiro"** em `Financeiro.tsx` (combobox com grupos ativos). Filtra rows cujas empresas pertencem ao grupo selecionado.

**Confirmação de envio em grupo** (`EditarMovimentacaoDialog.tsx`):
- Ao salvar com `data_envio_nota` novo e empresa pertencer a grupo → AlertDialog com 3 opções: "Todos do grupo" / "Somente este contrato" / "Cancelar".
- "Todos" → chama `aplicar_envio_nota_grupo`.

**Confirmação DDA/depósito em grupo**:
- Ao marcar DDA/Depósito em contrato do grupo → AlertDialog informando aplicação ao grupo inteiro → chama `aplicar_dda_grupo`.

**Alteração de vencimento em grupo**:
- Ao mudar `data_vencimento` em contrato do grupo → AlertDialog com "Aplicar para todos" / "Cancelar" → chama `aplicar_vencimento_grupo`.

**Anexos compartilhados**:
- `AnexosViewerDialog`: ao listar anexos, incluir também `anexos_financeiro` com `grupo_id` da empresa atual (via JOIN no `grupo_id` da empresa). Marcar com badge "Compartilhado pelo grupo [NOME]" para anexos com `contrato_origem_id` diferente da movimentação atual.
- Ao fazer upload em contrato do grupo: gravar `grupo_id` e `compartilhado_grupo = true` automaticamente, mantendo `contrato_origem_id` = movimentação atual. Storage é único (não duplica).

## 4. Hook utilitário

`useGrupoFinanceiro(empresaId)` — retorna `{ grupo, contratos, isLoading }` consultando `grupos_financeiros_contratos` ativos.

## 5. Auditoria automática

Triggers nas RPCs gravam em `grupos_financeiros_auditoria` com `dados_anteriores`/`dados_novos`.

## 6. O que NÃO muda

- Tipo de cobrança (`tipo_cobranca`): permanece por contrato, nunca replicado.
- Análise Excel × PDF, histórico, valores, divergências, cobrança retroativa: 100% individuais.
- Lógica atual de pagadores do mesmo contrato: intocada.

## Detalhes técnicos

- **Compartilhamento de anexos por período**: ações de envio/DDA/vencimento replicam para `financeiro_movimentacoes` com mesmo `(mes_referencia, periodo)` das empresas do grupo (cria registro se ausente).
- **Performance**: criar índices em `grupos_financeiros_contratos(empresa_id, ativo)` e `anexos_financeiro(grupo_id)`.
- **Segurança**: todas RPCs validam role admin OU autorização via `empresa_usuarios`/responsável para ações financeiras (envio/DDA/vencimento). Criação/remoção de grupo: admin only.
- **Cache**: invalidar React Query keys `["financeiro"]`, `["empresas"]`, `["grupos-financeiros"]` após mutações.
