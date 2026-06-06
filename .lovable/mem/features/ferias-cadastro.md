---
name: Férias do Cadastro
description: Módulo de férias com redistribuição automática balanceada e retorno automático preservando movimentações abertas
type: feature
---
Tabelas: `ferias_cadastro` (cabeçalho com status programada/em_andamento/aguardando_retorno_contratos/encerrada) e `ferias_cadastro_empresas` (1 linha por empresa redistribuída, histórico permanente).

RPCs (SECURITY DEFINER, search_path=public):
- `get_cadastro_workload()` carga atual de cada Cadastro (empresas ativas + implantações pendentes).
- `simular_redistribuicao_ferias(p_user_id)` algoritmo guloso: cada empresa vai ao destino com menor carga ponderada (empresas + 0.5*implantacoes).
- `criar_ferias_cadastro(user, nome, inicio, fim, atribuicoes)` cria registro; se inicio<=hoje aplica imediato trocando `empresas.responsavel_user_id`.
- `aplicar_ferias_programadas()` cron diário.
- `processar_retorno_ferias()` cron diário: devolve apenas se `tem_movimentacao_pendente()` é false; caso contrário mantém `aguardando_fechamento`.
- Trigger `trg_ferias_check_retorno` em movimentacoes: quando `data_envio_financeiro` é preenchido, devolve automaticamente.

Cron: job `ferias-daily-process` diário 06:00 UTC chama as duas funções.

Permissões: criar/alterar apenas admin/diretora (RLS); visualização para todos autenticados. UI: botão "Férias" em `/usuarios` apenas para admin/diretora.

Frontend: `FeriasSection` em Usuarios, `NovaFeriasDialog` (3 passos: período → simular → ajustar/confirmar), `ResponsaveisEmFeriasCard` no Dashboard.
