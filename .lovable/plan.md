## Estado atual

Já existem: wizard Vendas, envio para Diretoria, aprovar/rejeitar/correção com motivo, timeline, logs, alertas realtime para Diretora, RLS por perfil, finalização pelo Cadastro com mudança de status. Faltam três blocos para completar o pedido.

## 1. Atribuição direcionada Diretora → Cadastro

**Backend (migração)**
- Adicionar colunas `responsavel_cadastro_user_id uuid` e `responsavel_cadastro_nome text` em `implantacoes_contratos`.
- Alterar RPC `aprovar_implantacao(p_impl, p_observacao, p_responsavel uuid, p_responsavel_nome text)`: grava o responsável escolhido e cria o alerta com `destinatario_user_id = p_responsavel` (em vez de broadcast por role).
- Ajustar policy `Cadastro manage impl alertas` para também aceitar `destinatario_user_id = auth.uid()`.

**Frontend** — `AnaliseImplantacaoDialog.tsx`
- Botão "Aprovar e enviar ao Cadastro" abre sub-modal premium listando usuários Cadastro com nº de empresas ativas (via `get_comum_users_empresa_count`) e nº de implantações em andamento.
- Confirmar atribui responsável e aprova.

**ImplantacoesAndamentoCard / Dashboard Cadastro**: filtrar lista de "Aguardando Cadastro" por `responsavel_cadastro_user_id = auth.uid()` (admin vê tudo; legados sem responsável continuam visíveis para todo Cadastro).

## 2. Criação automática da empresa no "Contrato Implantado"

**Migração** — redefinir `finalizar_implantacao_cadastro(p_impl)`:

1. Se `empresa_id` já existir no contrato, só atualiza status.
2. Se houver empresa com mesmo `cnpj` (não-nulo), apenas vincula `empresa_id` ao contrato.
3. Caso contrário, INSERT em `public.empresas` mapeando: `nome ← nome_empresa`, `cnpj`, `codigo_contrato`, `grupo_contrato`, `endereco`, `telefone_empresa ← telefone`, `tipo_contrato`, `periodo_movimentacao`, `dia_movimentacao`, `data_corte`, `tipo_movimentacao` (derivado do periodo), `data_implantacao ← inicio_atendimento`, `vidas ← total_vidas`, `operadora_plano ← modalidade`, `responsavel_contrato ← created_by_nome`, `responsavel_user_id ← responsavel_cadastro_user_id`, `status_empresa = 'Ativa'`, `contrato_faixa_etaria ← (faixas_etarias is not null)`.
4. Adicionar coluna `empresa_id uuid` em `implantacao_anexos` e atualizar os anexos do contrato com o `empresa_id` recém-criado (arquivos físicos permanecem no bucket `anexos-implantacao`).
5. Atualiza status do contrato para `implantado`, log e finaliza alertas pendentes.

**Frontend**: toast pós-finalização "Empresa cadastrada automaticamente em Empresas".

## 3. Card de alertas para Vendas

**Novo componente** `src/components/dashboard/AlertasContratosVendas.tsx`
- Subscribe realtime em `implantacao_alertas` filtrado por `destinatario_role='vendas' AND destinatario_user_id = auth.uid() AND status='Pendente'`.
- Renderiza cards: nome empresa, tipo (`rejeitado` vermelho / `correcao` âmbar), motivo (`motivo_correcao`), botão "Corrigir e reenviar" → abre `ImplantacaoWizard`.
- Incluir em `Dashboard.tsx` para `isVendas`.

**ImplantacaoWizard.tsx**: banner topo quando `status in ('necessita_correcao','rejeitado')` mostrando `motivo_correcao`.

## 4. Arquivos a alterar/criar

- Nova migração (colunas + RPCs `aprovar_implantacao` e `finalizar_implantacao_cadastro` + policy).
- `src/components/implantacao/AnaliseImplantacaoDialog.tsx` (fluxo de atribuição).
- `src/components/implantacao/SelecionarResponsavelCadastroDialog.tsx` (novo).
- `src/components/implantacao/ImplantacaoWizard.tsx` (banner motivo).
- `src/components/dashboard/AlertasContratosVendas.tsx` (novo).
- `src/pages/Dashboard.tsx` (render condicional para Vendas).
- `src/components/dashboard/ImplantacoesAndamentoCard.tsx` (filtro por responsável).

## 5. Fora do escopo

- Dashboards de KPI/SLA dedicados (já há card de progresso).
- Backfill de contratos antigos (compatibilidade por fallback NULL).
- Reescrita visual do wizard.
