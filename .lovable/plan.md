## Prioridade Máxima — Plano de Implementação

Funcionalidade para destacar contratos urgentes em todo o fluxo (Empresas → Dashboard → Movimentações → Cadastro → Financeiro), com histórico imutável e permissões restritas a **Diretora** e **Admin**.

---

### 1. Banco de dados (migração)

**Nova tabela `empresa_prioridade_maxima`** (histórico imutável — uma linha por marcação/remoção):
- `empresa_id` (FK empresas)
- `motivo` (text, obrigatório)
- `observacoes` (text)
- `criado_por_user_id`, `criado_por_nome`, `criado_em`
- `removido_por_user_id`, `removido_por_nome`, `removido_em`, `motivo_remocao`
- `ativo` (boolean — gerado: `removido_em IS NULL`)

**Coluna em `empresas`**:
- `prioridade_maxima_id uuid` → referência à marcação ativa (cache para queries rápidas e ordenação)

**RLS**:
- SELECT: authenticated (todos visualizam)
- INSERT/UPDATE: somente `admin` ou `diretora` (via `has_role`)
- Sem DELETE (histórico nunca apagado)

**RPCs**:
- `marcar_prioridade_maxima(empresa_id, motivo, observacoes)` — valida permissão, insere histórico, atualiza `empresas.prioridade_maxima_id`
- `remover_prioridade_maxima(empresa_id, motivo_remocao)` — valida permissão, fecha registro ativo, zera `prioridade_maxima_id`

---

### 2. Componentes compartilhados

- `src/components/prioridade/PrioridadeBadge.tsx` — badge vermelho `⭐ PRIORIDADE MÁXIMA` (variantes: `default`, `pulsing`, `compact`)
- `src/components/prioridade/PrioridadeDialog.tsx` — dialog de confirmação (motivo obrigatório + observações)
- `src/components/prioridade/PrioridadeInfoCard.tsx` — exibe motivo, criador, data (usado em Cadastro e detalhes)
- `src/components/prioridade/PrioridadeHistoricoDialog.tsx` — lista completa do histórico
- `src/hooks/usePrioridadeMaxima.ts` — query + mutations + permissão (`canManagePrioridade = isAdmin || isDiretora`)
- CSS animação `animate-pulse-priority` em `tailwind.config.ts` / `index.css` (borda vermelha pulsante elegante)

---

### 3. Empresas (`src/pages/Empresas.tsx`)

- Botão `⭐ Definir como Prioridade Máxima` no menu de Ações (somente admin/diretora)
- Quando ativa: troca para `Remover Prioridade Máxima` + badge na linha
- Filtro: `Somente Prioridade Máxima` / `Ativas` / `Concluídas`
- Exportação CSV com colunas: Empresa, Responsável, Motivo, Criação, Status, Conclusão

### 4. Dashboard (`src/pages/Dashboard.tsx`)

- Novo card `Empresas com Prioridade Máxima` no topo: Empresa, Responsável, Período, Status, Dias restantes
- Listas existentes (período corrente) ordenadas com `prioridade_maxima_id IS NOT NULL` primeiro
- Linhas prioritárias recebem `PrioridadeBadge pulsing` enquanto não enviadas ao Financeiro (detectado via `movimentacoes.data_envio_financeiro IS NULL` no período atual)

### 5. Movimentações (`src/pages/Movimentacoes.tsx`)

- Badge na linha da empresa
- Quando período atual ativo e ainda não enviado: borda vermelha pulsante na linha

### 6. Cadastro (responsável)

- `PrioridadeInfoCard` no detalhe/dialog da empresa exibindo motivo, data, criador

### 7. Financeiro (`src/pages/Financeiro.tsx`)

- Badge `🔥 Prioridade Máxima` nas linhas/chips
- Ao receber (entrar em pendentes): destaque visual
- Alertas param naturalmente porque dependem do envio (já é o gatilho)

---

### 8. Detalhes técnicos

- Detecção "alerta ativo": empresa tem `prioridade_maxima_id IS NOT NULL` **E** existe movimentação no período atual sem `data_envio_financeiro`
- Período atual calculado via `_periodo_para_empresa` (já existe)
- Dias restantes: diferença até fim do período (`25-30` → dia 30; etc.)
- Sem cron necessário — alertas são derivados do estado em tempo real
- Permissão server-side garantida nas RPCs `SECURITY DEFINER` + RLS

---

### 9. Arquivos a criar/editar

**Criar:**
- migração SQL
- `src/hooks/usePrioridadeMaxima.ts`
- `src/components/prioridade/PrioridadeBadge.tsx`
- `src/components/prioridade/PrioridadeDialog.tsx`
- `src/components/prioridade/PrioridadeInfoCard.tsx`
- `src/components/prioridade/PrioridadeHistoricoDialog.tsx`
- `src/components/dashboard/PrioridadeMaximaCard.tsx`

**Editar:**
- `src/pages/Empresas.tsx` (botão, filtros, badge, export)
- `src/pages/Dashboard.tsx` (card + ordenação)
- `src/pages/Movimentacoes.tsx` (badge + pulsing)
- `src/pages/Financeiro.tsx` (badge 🔥)
- `tailwind.config.ts` + `src/index.css` (animação)

---

### 10. Memória de projeto

Adicionar `mem://features/prioridade-maxima.md` documentando regras (permissões, gatilho de fim de alerta, histórico imutável) e referenciar em `mem://index.md`.
