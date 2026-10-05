---
name: Avaliações por empresa (Carteira Samel)
description: Sistema de envio de avaliações RH com link único por empresa, captura de resposta, automação mensal e lembrete 7d.
type: feature
---
Tabela `avaliacoes_envios` (1 envio por empresa/mês) com token único. Link público `/avaliar/:token` (sem auth) identifica empresa+executiva, salva em `cs_avaliacao_respostas` (com `envio_id`) e marca `data_resposta`.

Tabela `avaliacoes_config` (single row, admin-only): `envio_mensal_ativo`, `dia_envio` (1-28), `dias_para_lembrete` (default 7), `lembrete_ativo`, `formulario_id`.

Função SECURITY DEFINER `processar_avaliacoes_envios()` rodando via pg_cron diário 08:00 UTC (job `avaliacoes-envios-diario`):
1. Cria envios para empresas EMPRESARIAL ativas sem envio no mês atual (a partir do `dia_envio`)
2. Marca `status='lembrete'` em envios sem resposta após N dias

UI em `/carteira-samel/avaliacoes/rh`: aba **Envios por empresa** (lista, gerar link individual/lote, copiar), aba **Dashboard** (rankings/médias), aba **Preview**. Configurações via `ConfigAvaliacoesDialog` (admin/diretora/executivo).

Envio de e-mail real ainda não implementado — link é copiado manualmente. Para plugar, criar edge function que consome `avaliacoes_envios` com `status='enviado'`/`'lembrete'` e `email_destino` preenchido.

Atualização 05/10/2026: aba "Avaliações Plantão" removida do sistema (tela AvaliacoesPlantao.tsx e EnviosPlantaoTab.tsx excluídos; rota /carteira-samel/avaliacoes/plantao retirada). Mantidos: dados no banco (tipo='plantao'), RPCs e a rota pública /avaliacoes/plantao/responder/:token com ResponderPlantao.tsx — QR Codes já distribuídos continuam funcionando. Avaliações Plantão seguem visíveis no Dashboard Diretoria.
