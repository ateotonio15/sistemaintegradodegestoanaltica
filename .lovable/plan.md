# Módulo Enterprise de Reajustes Anuais

## Visão geral
Evoluir o módulo já existente (`/reajustes`, tabelas `reajustes_anuais`, `reajuste_faixas`, RPC `solicitar_reajuste`, alertas, triggers) para o padrão Enterprise pedido, sem duplicar dados de Empresas/Implantação/Financeiro/Movimentações.

O sistema já possui boa parte da base: fluxo de solicitação, faixas etárias, separação Enfermaria/Apartamento, cálculo automático via trigger, alertas no dashboard. A entrega consolida o que falta: aprovação/rejeição pela Diretora, liberação para o Financeiro, status "Retroativo Aplicado", timeline completa, filtros avançados e exportação.

## Banco de dados (migração única)

### 1. Tabela `reajustes_anuais` — ajustes
Reutiliza a tabela atual. Adicionar apenas o que falta:
- `ano smallint` (preenchido por trigger a partir de `data_aplicacao`)
- `UNIQUE (empresa_id, ano)` (substitui a unique atual em `empresa_id, mes_reajuste, valor_antigo_centavos`)
- Expandir enum `status_reajuste` com: `aguardando_aprovacao`, `aprovado`, `rejeitado`, `liberado_financeiro`, `retroativo_aplicado` (mantendo os atuais `solicitado`, `pendente_confirmacao`, `reajustado`)
- Colunas de fluxo: `aprovado_por_user_id/nome/em`, `rejeitado_por_user_id/nome/em`, `motivo_rejeicao text`, `liberado_por_user_id/nome/em`, `retroativo_aplicado_por_user_id/nome/em`

### 2. Tabela `reajustes_historico` (nova, append-only)
Para a timeline auditável:
- `id`, `reajuste_id`, `empresa_id`, `evento` (solicitado/confirmado/aprovado/rejeitado/liberado/retroativo_aplicado/editado), `usuario_id`, `usuario_nome`, `observacao`, `dados jsonb`, `created_at`
- GRANTs: SELECT/INSERT para `authenticated`, ALL para `service_role`; RLS: leitura para usuários ligados à empresa, escrita só via funções `SECURITY DEFINER`

### 3. Faixas etárias
Mantém `reajuste_faixas` já existente (10 faixas configuráveis). Sem alteração estrutural.

### 4. RPCs (`SECURITY DEFINER`)
- `solicitar_reajuste` — já existe, ajustar para gravar histórico
- `confirmar_reajuste(p_id)` — Cadastro confirma valores → status `aguardando_aprovacao`
- `aprovar_reajuste(p_id, p_obs)` — Diretora aprova → status `aprovado`
- `rejeitar_reajuste(p_id, p_motivo)` — Diretora rejeita → status `rejeitado` + motivo + alerta para Cadastro/Visualização
- `liberar_reajuste_financeiro(p_id)` — Diretora libera → status `liberado_financeiro` + alerta para Financeiro
- `aplicar_retroativo(p_id)` — Financeiro marca → status `retroativo_aplicado`
Toda RPC: valida role via `has_role`, grava em `reajustes_historico`, atualiza/cria registros em `alertas_reajuste`.

### 5. Triggers
- Manter `trg_reajuste_calc_campos` (cálculos automáticos)
- Manter `trg_criar_alerta_reajuste` e `trg_finalizar_alerta_reajuste` — expandir para os novos status (criar alertas por destinatário/role correto)
- Novo trigger: ao inserir/atualizar `reajustes_anuais`, derivar `ano` automaticamente de `data_aplicacao`

## Frontend

### Página `/reajustes` (refatorar a existente)
- KPIs: Total, Reajustados, Pendentes, Atrasados, Aguardando Aprovação, Liberados, Retroativos Aplicados
- Filtros: Ano, Mês, Empresa, Contrato, CNPJ, Responsável, Status (combobox com busca, mesmo padrão do Financeiro)
- Tabela: empresa, contrato, mês oficial, status (badge colorido por `corStatusReajusteFluxo`), valor final, ações contextuais por role
- Botão "Solicitar Reajuste" — abre `SolicitarReajusteDialog` (já existe)
- Botão "Exportar" → Excel (xlsx) e PDF (jsPDF + autotable, mesmo padrão do `gestao-vidas-export`)

### Diálogos
- `SolicitarReajusteDialog` — já existe, reutilizar. Ajustar para gravar histórico via RPC.
- `ReajusteDialog` (Cadastro confirma valores) — já existe; adicionar botão "Confirmar e enviar à Diretora"
- `AprovarReajusteDialog` (novo, Diretora): mostra valores Enf/Apt separados, faixas etárias, percentual, retroativo. Ações: Aprovar / Rejeitar (com motivo obrigatório) / Liberar para Financeiro
- `AplicarRetroativoDialog` (novo, Financeiro): exibe valor retroativo + valor final, confirma aplicação
- `ReajusteHistoricoDialog` — já existe; preencher com dados de `reajustes_historico` (timeline com ícone por evento, usuário, data/hora, observação, motivo de rejeição destacado)

### Cards de alerta no Dashboard
- `AlertaReajustesPendentes` — já existe (Visualização: empresas sem reajuste no ano)
- `AlertaReajustesParaConfirmar` — já existe (Cadastro)
- `AlertaReajustesParaAprovar` (novo, Diretora)
- `AlertaRetroativosParaCobrar` (novo, Financeiro, no `DashboardFinanceiro`)
Todos filtram automaticamente por status atual e somem quando a etapa é concluída.

### Permissões (frontend + RLS espelhada)
| Ação | Visualização | Cadastro | Diretora | Financeiro | Admin |
|---|---|---|---|---|---|
| Solicitar | ✅ | ✅ | ✅ | — | ✅ |
| Editar valores | — | ✅ (antes de aprovar) | — | — | ✅ |
| Confirmar | — | ✅ | — | — | ✅ |
| Aprovar/Rejeitar/Liberar | — | — | ✅ | — | ✅ |
| Aplicar retroativo | — | — | — | ✅ | ✅ |
| Ver histórico | ✅ | ✅ | ✅ | ✅ | ✅ |

### Cálculos (`src/lib/reajuste-utils.ts`)
Mantém utils atuais. Adicionar apenas:
- helper `proximoStatus(status)` para o fluxo
- helper `podeExecutarAcao(role, status, acao)` centralizando permissões

## Regras importantes preservadas
- Mês oficial: **sempre** derivado de `empresas.data_implantacao` (já implementado em `getMesReajuste` + trigger)
- Enfermaria e Apartamento calculados **individualmente**, nunca somados automaticamente (já implementado)
- Faixas etárias com 10 faixas fixas (já implementado em `FAIXAS_ETARIAS`)
- Reutiliza `empresas`, `profiles`, `user_roles`, `alertas_reajuste` — zero duplicação
- Histórico append-only — nunca excluir

## Entregáveis
1. Migração SQL (tabelas, enums, RPCs, triggers, RLS, GRANTs)
2. Refactor `src/pages/Reajustes.tsx` (filtros + exportação + ações por role)
3. Novos diálogos: `AprovarReajusteDialog`, `AplicarRetroativoDialog`
4. Atualização `ReajusteHistoricoDialog` para usar `reajustes_historico`
5. Novos cards: `AlertaReajustesParaAprovar`, `AlertaRetroativosParaCobrar`
6. Utilitário de export Excel/PDF de reajustes
7. Atualização de memórias do projeto com o novo fluxo

Posso seguir?
