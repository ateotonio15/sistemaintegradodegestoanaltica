---
name: Reajustes Enterprise
description: Fluxo completo do módulo de reajustes anuais (Visualização → Cadastro → Diretora → Financeiro) com histórico e alertas.
type: feature
---

Tabelas: `reajustes_anuais` (status_reajuste text, colunas aprovado_*, rejeitado_* + motivo_rejeicao, retroativo_aplicado_*), `reajuste_faixas` (10 faixas), `reajustes_historico` (append-only, timeline), `alertas_reajuste` (com destinatario_role e tipo).

Status do fluxo: solicitado → pendente_confirmacao → aguardando_aprovacao → aprovado → liberado_financeiro → retroativo_aplicado (caminho sem retro: → reajustado). Status rejeitado retorna para Cadastro com motivo obrigatório.

RPCs (SECURITY DEFINER + has_role check):
- `solicitar_reajuste(p_empresa_id)` — Visualização/Admin
- `confirmar_reajuste_cadastro(p_id)` — Cadastro envia à Diretora
- `aprovar_reajuste(p_id, p_obs)` — Diretora aprova
- `rejeitar_reajuste(p_id, p_motivo)` — Diretora rejeita (motivo obrigatório)
- `liberar_reajuste_financeiro(p_id)` — Diretora libera retroativo
- `aplicar_retroativo_reajuste(p_id, p_obs)` — Financeiro finaliza

Componentes: `SolicitarReajusteDialog`, `ReajusteDialog`, `AprovarReajusteDialog`, `AplicarRetroativoDialog`, `ReajusteHistoricoDialog` (timeline visual).

Alertas dashboard: `AlertaReajustesPendentes` (Visualização), `AlertaReajustesParaConfirmar` (Cadastro), `AlertaReajustesParaAprovar` (Diretora), `AlertaRetroativosParaCobrar` (Financeiro/DashboardFinanceiro).

Export: `src/lib/reajustes-export.ts` — Excel (ExcelJS) e PDF (window.print HTML).

Mês de reajuste **sempre** derivado de `empresas.data_implantacao` via `getMesReajuste` + trigger `trg_reajuste_calc_campos`. Enfermaria e Apartamento calculados individualmente (nunca somados).
