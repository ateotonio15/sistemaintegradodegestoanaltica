# Fluxo Pós-Implantação: "Contrato Recém Implantado"

Cria fase intermediária entre Implantação e Movimentação, evitando que contratos recém implantados entrem indevidamente em faturamentos/movimentações antes da primeira competência válida.

## 1. Banco de dados (migração)

**Em `empresas`:**
- `status_implantacao text` — valores: `aguardando_primeiro_fechamento` | `ativo` (default `ativo` p/ retrocompat).
- `primeira_competencia_financeira text` (`YYYY-MM`) — calculada automaticamente.
- `primeiro_fechamento_em timestamptz` — preenchido quando ativa.
- `primeiro_processamento_financeiro_em timestamptz`.

**Função `calcular_primeira_competencia(empresa_id)`** — SECURITY DEFINER:
- Lê `data_implantacao`, `tipo_contrato`, `tipo_movimentacao`, `periodo_movimentacao`, `dia_movimentacao`, `data_corte`.
- Determina o dia/janela de corte do mês da implantação.
- Se `data_implantacao` ≤ dia de corte do mês corrente → primeira competência = mês corrente.
- Caso contrário → mês seguinte.
- Retorna `YYYY-MM`.

**Função `ativar_contrato_recem_implantado(empresa_id)`** — SECURITY DEFINER:
- Só age se `status_implantacao = 'aguardando_primeiro_fechamento'` e mês atual ≥ `primeira_competencia_financeira`.
- Define `status_implantacao = 'ativo'`, registra timestamps de histórico, gera alerta tipo `primeiro_fechamento_disponivel` para Financeiro.

**Trigger de ativação automática:**
- Cron job diário (pg_cron já habilitado) chamando função `ativar_contratos_pendentes()` que itera empresas em `aguardando_primeiro_fechamento` cuja competência chegou.
- Adicionalmente, ao abrir o Dashboard, frontend chama RPC `ativar_contratos_pendentes()` como fallback.

**Ajuste `finalizar_implantacao_cadastro`:**
- Após criar/atualizar empresa, definir `status_implantacao = 'aguardando_primeiro_fechamento'` e gravar `primeira_competencia_financeira` via `calcular_primeira_competencia`.
- **NÃO** criar movimentação imediata (hoje já não cria; manter).
- Inserir alertas: para Cadastro (`contrato_aguardando_fechamento`) e para Financeiro (`contrato_disponivel_primeiro_fechamento` — só dispara ao ativar).

**Histórico** (nova tabela `empresa_implantacao_historico`):
- `empresa_id`, `data_implantacao`, `primeira_competencia`, `primeiro_fechamento_em`, `primeiro_processamento_em`, timestamps. Grants padrão + RLS para Cadastro/Financeiro/Diretora/Admin.

## 2. Regras de exclusão nas movimentações/faturamentos

Em todas as queries de:
- `Movimentacoes.tsx`, `FaturamentosEnviadosCard`, `FaturamentosEnviadoFinanceiro`, `ContratosAVigenciarCard`, dashboards de pendências.

Adicionar filtro: empresa só aparece se `status_implantacao = 'ativo'` **OU** se `mes_referencia >= primeira_competencia_financeira`.

Também ajustar provisionamento automático de movimentações para pular empresas em `aguardando_primeiro_fechamento`.

## 3. Nova seção "Contratos Recém Implantados"

Nova página `src/pages/ContratosRecemImplantados.tsx` + rota `/contratos-recem-implantados`.

Acesso: Admin, Cadastro (comum/administradoras), Financeiro, Diretora.

Tabela com colunas: Empresa, Contrato, Data Implantação, Data Vigência, Tipo Movimentação, Período, Vidas, Responsável, Próximo Fechamento, Anexos.

Ações:
- **Cadastro**: anexar relatório implantação, relatório vidas, documentos finais, conferências (reusar bucket `implantacao-anexos` com nova categoria `pos_implantacao`).
- **Financeiro**: visualização read-only de contrato, anexos, vidas, dados de implantação. Sem botões de "enviar ao financeiro" / "registrar nota".
- **Diretora**: read-only.

Item de menu na sidebar (`AppLayout.tsx`) com badge contando empresas pendentes.

## 4. Cards de dashboard

**Dashboard Cadastro** (`src/pages/Dashboard.tsx`): novo card `ImplantacoesAguardandoFechamentoCard` com:
- Total de contratos
- Total de vidas
- Data do próximo fechamento mais próximo
- Click → `/contratos-recem-implantados`

**Dashboard Financeiro** (`DashboardFinanceiro.tsx`): novo card `ContratosAguardandoPrimeiroFechamentoCard` listando empresa, vidas, período, data prevista.

## 5. Alertas

Reutilizar `alertas_financeiro` com novos `tipo`:
- `contrato_aguardando_fechamento` (destinatário: Cadastro responsável)
- `primeiro_fechamento_disponivel` (destinatário: Financeiro) — disparado na ativação automática

## 6. Frontend ajustes auxiliares

- `src/lib/movimentacao-utils.ts`: helper `isEmpresaAtivaParaCompetencia(empresa, mesRef)` reusado em filtros.
- Tipos: regenerar via Supabase (automático).
- Hook leve `useAtivarContratosPendentes()` chamado uma vez no mount do `AppLayout` (RPC noop se nada).

## Detalhes técnicos resumidos

- Migration única com: ALTER TABLE empresas (3 colunas), CREATE TABLE histórico + GRANTs + RLS, 3 funções SECURITY DEFINER, cron diário às 03:00 UTC, ajuste em `finalizar_implantacao_cadastro`.
- Backfill: empresas existentes ficam com `status_implantacao = 'ativo'` (não impacta fluxo atual).
- Sem mudança em RLS de movimentações; apenas filtros no frontend + guard no provisionamento.
- Sem nova dependência npm.

## Fora de escopo

- Notificações por e-mail (sistema atual usa alertas in-app).
- Edição/cancelamento manual do status `aguardando_primeiro_fechamento` (será apenas via ativação automática, conforme item 12).

Confirma esse plano para eu implementar?
