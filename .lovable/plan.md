## Etapa 15 — Fluxo de Aprovação do Reajuste

Criar fluxo onde o perfil **Visualização** cria o reajuste e o perfil **Cadastro (comum)** confirma, com alerta automático e status visuais.

### 1. Banco de dados (migration)

Alterar tabela `reajustes_anuais`:
- Adicionar `status_reajuste text NOT NULL DEFAULT 'pendente_confirmacao'` (valores: `pendente_confirmacao`, `reajustado`)
- Adicionar `confirmado_por uuid` (user_id de quem confirmou)
- Adicionar `confirmado_por_nome text`
- Adicionar `data_confirmacao timestamptz`
- Migrar dados existentes: `UPDATE reajustes_anuais SET status_reajuste = 'reajustado'` (registros antigos contam como já confirmados)

Atualizar policies RLS de `reajustes_anuais`:
- **Admin / Visualização**: INSERT, UPDATE, DELETE (já existem)
- **Comum (Cadastro)**: nova policy UPDATE somente para confirmar (vínculo via `responsavel_user_id` da empresa ou `empresa_usuarios`)
- Trigger `guard_reajuste_comum`: quando o usuário tem role `comum`, só permite alterar `status_reajuste`, `confirmado_por`, `confirmado_por_nome`, `data_confirmacao` (bloqueia mudança de valores/percentual)

Criar nova tabela `alertas_reajuste`:
- `id`, `reajuste_id` (FK lógico), `empresa_id`, `empresa_nome`, `criado_por_user_id`, `criado_por_nome`, `destinatario_user_id` (responsável Cadastro), `status` (`Pendente`/`Finalizado`), `finalizado_em`, `created_at`, `updated_at`
- RLS: leitura para autenticados; admin/visualização gerenciam; comum atualiza/lê os seus
- Trigger `trg_criar_alerta_reajuste` AFTER INSERT em `reajustes_anuais` → cria alerta para o responsável da empresa
- Trigger `trg_finalizar_alerta_reajuste` AFTER UPDATE em `reajustes_anuais` quando `status_reajuste` muda para `reajustado` → marca alerta como `Finalizado`

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE reajustes_anuais, alertas_reajuste;`

### 2. Backend utils (`src/lib/reajuste-utils.ts`)

- Adicionar tipo `StatusReajusteFluxo = 'pendente_confirmacao' | 'reajustado'`
- Função `labelStatusReajusteFluxo(s)` → "Reajuste enviado para o Cadastro" / "Reajustado"
- Função `corStatusReajusteFluxo(s)` → amarelo / verde

### 3. UI — Página Reajuste (`src/pages/Reajustes.tsx`)

Atualizar tabela com colunas:
Empresa · Contrato · Percentual · Valor antigo · Valor reajustado · Data aplicação · **Status** (badge fluxo) · Responsável (Cadastro) · Ações

Ações por linha:
- **Comum** (responsável da empresa) e status = `pendente_confirmacao` → botão "Confirmar Reajuste"
- **Admin / Visualização** → editar / excluir / histórico (mantém existente)
- Demais perfis → somente histórico

KPIs: ajustar contadores para usar `status_reajuste` em vez de só presença na tabela.

### 4. UI — Diálogo de criação (`ReajusteDialog.tsx`)

Ao salvar (INSERT) o status já nasce `pendente_confirmacao` por default. Toast: "Reajuste criado. Cadastro foi notificado."

### 5. UI — Confirmação pelo Cadastro

Novo handler `confirmarReajuste(id)`:
- UPDATE `reajustes_anuais` SET `status_reajuste='reajustado'`, `confirmado_por=auth.uid()`, `confirmado_por_nome=display_name`, `data_confirmacao=now()`
- Trigger finaliza o alerta automaticamente
- Invalida queries `reajustes-anuais`, `alertas-reajuste-count`, `reajustes-pendentes-count`

### 6. Alertas visuais

Novo componente `AlertaReajustesParaConfirmar.tsx`:
- Conta `alertas_reajuste` com `status='Pendente'` e `destinatario_user_id=auth.uid()` (ou todos, para admin)
- Banner laranja/amarelo com link para `/reajustes`
- Exibido em `Dashboard.tsx` (já tem `AlertaReajustesPendentes` para anuais — manter ambos)

Atualizar `AlertaReajustesPendentes.tsx`: continuar contando empresas sem reajuste no ano (independente).

### 7. Histórico (`ReajusteHistoricoDialog.tsx`)

Mostrar adicionalmente: criado por, data criação, confirmado por, data confirmação, status atual.

### 8. Realtime

Em `Reajustes.tsx` e nos componentes de alerta, subscrever channel em `reajustes_anuais` e `alertas_reajuste` para invalidar React Query automaticamente.

### Permissões — resumo

| Perfil | Criar | Editar valores | Confirmar | Excluir | Ver |
|---|---|---|---|---|---|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Visualização | ✅ | ✅ | ❌ | ✅ | ✅ |
| Comum (Cadastro, responsável) | ❌ | ❌ | ✅ | ❌ | ✅ |
| Financeiro / Executivo / Enfermeira | ❌ | ❌ | ❌ | ❌ | ✅ |

### Arquivos afetados

- `supabase/migrations/<novo>.sql` (campos + tabela alertas + triggers + RLS + realtime)
- `src/lib/reajuste-utils.ts`
- `src/pages/Reajustes.tsx`
- `src/components/reajustes/ReajusteDialog.tsx`
- `src/components/reajustes/ReajusteHistoricoDialog.tsx`
- `src/components/reajustes/AlertaReajustesParaConfirmar.tsx` (novo)
- `src/pages/Dashboard.tsx` (incluir novo banner)
- `src/integrations/supabase/types.ts` (auto)
