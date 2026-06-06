## ETAPA 54 — Gestão de Férias (Cadastro)

Módulo completo para redistribuir empresas de um responsável Cadastro durante férias, com retorno automático.

### 1. Banco de Dados (migration)

**Tabela `ferias_cadastro`** (cabeçalho da férias):
- `id`, `responsavel_original_user_id`, `responsavel_original_nome`
- `data_inicio`, `data_fim`
- `status` enum: `programada`, `em_andamento`, `encerrada`, `aguardando_retorno_contratos`
- `criado_por_user_id`, `criado_por_nome`, `created_at`, `updated_at`
- `iniciada_em`, `encerrada_em`

**Tabela `ferias_cadastro_empresas`** (redistribuição linha-a-linha — esta é o histórico):
- `id`, `ferias_id` (FK), `empresa_id`
- `responsavel_original_user_id`, `responsavel_temporario_user_id`
- `responsavel_temporario_nome`
- `redistribuida_em`, `retornada_em`
- `status` enum: `pendente_inicio`, `redistribuida`, `aguardando_fechamento`, `retornada`
- `motivo_retencao` text (quando ficou retida por movimentação aberta)

RLS: SELECT para todos autenticados; INSERT/UPDATE/DELETE apenas `admin` e `diretora`. GRANTs corretos.

**Funções RPC (SECURITY DEFINER, search_path = public):**
- `get_cadastro_workload()` → retorna user_id, nome, empresas, contratos_ativos, implantacoes (para o modal).
- `simular_redistribuicao_ferias(p_user_id, p_data_inicio, p_data_fim)` → retorna jsonb com `{antes:[...], depois:[...], atribuicoes:[{empresa_id, nome, responsavel_temp_id, responsavel_temp_nome}]}` usando algoritmo guloso (atribui empresa ao destino com menor carga ponderada).
- `criar_ferias_cadastro(p_user_id, p_data_inicio, p_data_fim, p_atribuicoes jsonb)` → cria registros e, se `data_inicio <= hoje`, executa redistribuição imediata; cria notificações.
- `aplicar_ferias_programadas()` → cron diário: marca `em_andamento`, troca `empresas.responsavel_user_id` (salvando original), notifica.
- `processar_retorno_ferias()` → cron diário: para cada férias com `data_fim < hoje`, para cada empresa redistribuída verifica `tem_movimentacao_pendente(empresa_id)` (sem `data_envio_financeiro` no período atual). Se não tem, devolve ao original; se tem, mantém e marca `aguardando_fechamento`. Atualiza status do cabeçalho.
- `tem_movimentacao_pendente(empresa_id)` helper.
- Trigger em `movimentacoes` (após UPDATE de `data_envio_financeiro`): se a empresa está em `aguardando_fechamento` e não há mais pendência, devolve ao responsável original automaticamente.

**Notificações:** inserir em `notificacoes` existente com tipos `ferias_iniciada` / `ferias_retorno`.

**Cron (pg_cron + pg_net):** job diário 06:00 chamando edge function `ferias-cron` que invoca as duas funções acima. *(Ou direto via cron.schedule SQL).*

### 2. Frontend

**Página/seção:** Adicionar na página `/usuarios` (Usuarios.tsx) uma aba/seção "Gestão de Férias" visível para todos, com botão **Férias** apenas para `admin`/`diretora`.

**Componentes novos:**
- `src/components/ferias/FeriasCard.tsx` — lista férias ativas/programadas/encerradas.
- `src/components/ferias/NovaFeriasDialog.tsx` — 3 steps:
  1. Selecionar responsável + período (mostra contadores).
  2. **Simulador** — tabela Responsável | Antes | Depois (chamando `simular_redistribuicao_ferias`).
  3. Edição manual — lista empresas com `<Select>` para mudar responsável temporário; mostra resumo recalculado.
  4. Confirmar → `criar_ferias_cadastro`.
- `src/components/dashboard/ResponsaveisEmFeriasCard.tsx` — card no Dashboard (perfis cadastro/admin/diretora) listando férias em andamento com nome, período, redistribuídas, pendentes de devolução.
- Badge **Responsável Temporário** em `Empresas.tsx` (tooltip com original, temporário, período).

### 3. Permissões

- Botão Férias e ações: `isAdmin || isDiretora`.
- Visualização: todos os perfis do Cadastro (comum, administradoras), admin, diretora.

### 4. Pontos técnicos

- Algoritmo de balanceamento: ordena destinos por `(empresas + 0.5*implantacoes)` e atribui cada empresa do responsável de férias ao destino de menor carga, atualizando carga incrementalmente (min-heap simples em SQL via loop PL/pgSQL).
- "Movimentação pendente" = registro em `movimentacoes` do período atual sem `data_envio_financeiro` OU `financeiro_movimentacoes` sem `data_envio_nota`.
- Mantemos `responsavel_user_id` na empresa atualizado durante férias; o "original" vive em `ferias_cadastro_empresas`.

### 5. Arquivos

Migration:
- `supabase/migrations/<ts>_ferias_cadastro.sql` (tabelas, enums, RLS, GRANTs, RPCs, trigger).

Cron job: inserir via `supabase--insert` após migration aprovada.

Frontend:
- `src/components/ferias/FeriasCard.tsx`
- `src/components/ferias/NovaFeriasDialog.tsx`
- `src/components/dashboard/ResponsaveisEmFeriasCard.tsx`
- `src/hooks/useFerias.ts`
- editar `src/pages/Usuarios.tsx` (adicionar seção)
- editar `src/pages/Empresas.tsx` (badge Responsável Temporário)
- editar `src/pages/Dashboard.tsx` (adicionar card)
- atualizar `mem://index.md` + nova memory `mem://features/ferias-cadastro`.
