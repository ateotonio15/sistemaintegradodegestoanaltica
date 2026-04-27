## Objetivo

Tornar o envio ao Financeiro **100% manual**. Hoje existe um trigger no banco que envia a empresa ao Financeiro automaticamente assim que o Cadastro preenche `data_envio_financeiro`. Isso será desativado. A empresa só vai ao Financeiro quando o usuário Cadastro clicar no botão **"Enviar ao Financeiro"** ao lado da empresa.

## Fluxo desejado

```text
Dashboard Cadastro
┌──────────────────────────────────────────────────┐
│ Empresa XYZ · Contrato 123    [Enviar ao Fin.] │  ← clique manual
└──────────────────────────────────────────────────┘
                       │ clique
                       ▼
   Cria alerta + registra usuário/data/hora
                       │
                       ▼
              Dashboard Financeiro
┌──────────────────────────────────────────────────┐
│ Empresa XYZ · Contrato 123 · Enviado por João    │
│ 27/04/2026 14:32 · 3 anexos                      │
└──────────────────────────────────────────────────┘
                       │ Financeiro preenche Vencimento
                       ▼
                Empresa some da lista
                Botão volta ao normal no próximo ciclo
```

## Mudanças

### 1. Banco — desligar o envio automático

- **Drop do trigger** `trg_envio_financeiro` na tabela `movimentacoes`. A função `handle_envio_financeiro()` permanece como referência, mas não roda mais sozinha.
- Resultado: preencher `data_envio_financeiro` deixa de criar alerta, deixa de espelhar anexos e deixa de criar registro em `financeiro_movimentacoes`. Nada vai ao Financeiro sem clique.

### 2. Banco — RPC para o botão fazer tudo de forma segura

Criar função `enviar_movimentacao_ao_financeiro(p_mov_id uuid)` com `SECURITY DEFINER` que executa, em uma transação, o que o trigger fazia — mas só sob comando explícito do clique:

1. Garante registro em `financeiro_movimentacoes` (empresa + mês + período do `mov_id`).
2. Espelha anexos de `anexos_movimentacao` → `anexos_financeiro` (sem duplicar).
3. Faz upsert em `alertas_financeiro`:
   - `tipo = 'vencimento'`
   - `status = 'Pendente'`
   - `enviado_por_user_id = auth.uid()`
   - `enviado_por_nome = display_name` do usuário
   - `data_envio = CURRENT_DATE` (a hora fica registrada em `created_at`)
4. Preenche `data_envio_financeiro` na movimentação para histórico (já não dispara nada).

A escolha por `tipo='vencimento'` é proposital: o trigger `handle_finalizar_alerta_vencimento` (já existe) finaliza o alerta automaticamente quando o Financeiro preenche `data_vencimento` em `financeiro_movimentacoes`, fazendo a empresa sair da lista. A UI do Financeiro (`AlertasVencimentoFinanceiro.tsx`) já consome exatamente esse tipo.

`SECURITY DEFINER` evita ter que abrir múltiplas RLS policies para o role `comum` em três tabelas diferentes (`alertas_financeiro`, `anexos_financeiro`, `financeiro_movimentacoes`).

### 3. Frontend — `FaturamentosEnviadosCard.tsx` (Dashboard Cadastro)

A lista de empresas do ciclo continua igual. Em cada linha, substituir os badges de status e o botão "Alertar vencimento" por **um único botão de ação**:

- **Estado "não enviado"** (sem alerta `vencimento` Pendente para essa movimentação):
  - Botão pequeno e elegante: **"Enviar ao Financeiro"** (ícone Send, `size="sm"`, variant default em verde primário).
- **Estado "enviado"** (alerta `vencimento` Pendente já existe):
  - Botão **"Enviado"** desabilitado, com check, em tom suave de sucesso.
- **Estado "ciclo concluído"** (Financeiro já preencheu vencimento, alerta finalizado):
  - Botão volta para **"Enviar ao Financeiro"** (novo ciclo, novo envio possível).

No clique: `supabase.rpc('enviar_movimentacao_ao_financeiro', { p_mov_id: linha.movId })`. Após sucesso: `toast` de confirmação e invalidação de cache. Se a movimentação ainda não existe (Pendente), o botão fica desabilitado com tooltip "Movimente o contrato primeiro".

Remover do card: switch "Apenas com ação pendente", badges de status (Pendente/Enviado/Finalizado) e badges de contagem ("pendentes" / "aguardando vencimento") no header. Mantemos: nome da empresa, contrato, mês/período, contador de anexos e o botão.

### 4. Frontend — Dashboards Financeiro

Sem mudanças visuais. O card "Faturamentos Enviado" do Financeiro (`AlertasVencimentoFinanceiro.tsx`) já lê `alertas_financeiro` com `tipo='vencimento'` e `status='Pendente'` — passará a receber exatamente os alertas criados pelo botão. A empresa some quando o Financeiro preenche `data_vencimento`.

O card "Notas a Enviar" (`FaturamentosEnviadoFinanceiro.tsx`, alertas `tipo='nota'`) ficará sem entradas vindas do Cadastro — continua existindo para compatibilidade caso outro fluxo crie alertas tipo nota no futuro.

## Detalhes técnicos

- **Migração SQL**:
  - `DROP TRIGGER IF EXISTS trg_envio_financeiro ON public.movimentacoes;`
  - `CREATE OR REPLACE FUNCTION public.enviar_movimentacao_ao_financeiro(p_mov_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ... $$;` — encapsula os 4 passos acima e valida que o usuário logado tem vínculo com a empresa (`empresa_usuarios` ou `empresas.responsavel_user_id`) ou é admin.
- **Arquivo principal alterado**: `src/components/dashboard/FaturamentosEnviadosCard.tsx`
  - Substituir `alertarVencimento` por `enviarAoFinanceiro(linha)` que chama a RPC.
  - Reescrever a renderização da linha: 1 botão com 2 estados, sem badges de status.
  - Simplificar header (remove switch e contadores derivados de status).
- **Sem alterações** em `AlertasVencimentoFinanceiro.tsx` e `FaturamentosEnviadoFinanceiro.tsx`.
- **Memória atualizada**: `mem://features/alerta-vencimento` e `mem://features/faturamentos-enviado` para refletir que o disparo é manual via RPC, não mais por trigger automático.

## Resultado esperado

- Nenhuma empresa aparece no Dashboard Financeiro até alguém clicar.
- Cada clique registra usuário (`enviado_por_nome`/`enviado_por_user_id`), data (`data_envio`) e hora (`created_at`).
- Botão muda para "Enviado" (desabilitado) imediatamente após o envio.
- Quando o Financeiro preenche Vencimento, alerta finaliza, empresa some do Financeiro e o botão do Cadastro fica liberado para o próximo ciclo.
