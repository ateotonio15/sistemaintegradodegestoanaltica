## Etapa 29 — Filtro por Responsável + Mês de Reajuste

### Objetivo
Na aba Reajuste e nos alertas do Dashboard, filtrar empresas por responsável (perfil Cadastro vê só as suas) e adicionar filtro por **Mês de Reajuste** (baseado no mês da implantação).

### Premissas (importante confirmar)
- **Cadastro (Comum)**: vê apenas empresas onde é `responsavel_user_id` ou está em `empresa_usuarios`. Vale para a aba Reajuste, alertas do Dashboard, KPIs, lista de pendentes e solicitações.
- **Visualização e Admin**: continuam vendo **todas** as empresas ativas (Visualização é quem solicita reajustes; restringir por responsável quebraria o fluxo, já que Visualização não tem vínculo de responsabilidade no banco). Filtro de mês fica disponível para todos.
- **Executivo / Financeiro / Enfermeira**: sem mudança (não usam a aba Reajuste).

> Se você quiser que Visualização também seja filtrada por algum vínculo (ex.: `executiva_user_id`), me avise antes que eu implemente — hoje não há campo equivalente para Visualização.

### Mudanças

#### 1. `src/pages/Reajustes.tsx`
- Carregar `empresa_usuarios` do usuário logado quando `isComum` (já existe a query `minhasEmpresas`).
- Filtrar `empresas` antes do `useMemo` de `rows` e de `kpis`:
  - Se `isComum`: manter só empresas onde `responsavel_user_id === user.id` **ou** `id ∈ minhasEmpresasSet`.
  - Caso contrário: manter todas.
- Adicionar novo state `filterMes` (string: `"all"` ou `"1"`..`"12"`).
- Adicionar `<Select>` "Mês de Reajuste" na barra de filtros (ao lado do filtro de Status), com opções "Todos" + Janeiro–Dezembro.
- No `rows.filter`, descartar empresa cujo `getMesReajuste(empresa.data_implantacao)` não bate com `filterMes` (quando ≠ "all").
- KPIs também devem refletir os filtros (responsável + mês) — recalcular sobre a lista filtrada de empresas.
- Atualização sem reload (já é via React Query / `useMemo`).

#### 2. `src/components/reajustes/AlertaReajustesPendentes.tsx`
- Receber `useAuth` (`user`, `isComum`) e, quando `isComum`, buscar `empresa_usuarios` do user e filtrar as empresas retornadas pela query antes de montar `pendentes`. Considerar também `responsavel_user_id` (incluir esse campo no `select`).
- Adicionar estado `filterMes` e um `<Select>` compacto no cabeçalho do card (ao lado do botão "Ocultar"/"Abrir aba"): "Todos" + 12 meses. Filtrar `lista` exibida.
- Manter contagem (`total`, `atrasados`) baseada na lista filtrada por responsável (mas independente do filtro de mês — o filtro de mês é só visual; o badge mostra o total real de pendências do usuário).

#### 3. `src/components/reajustes/AlertaReajustesParaConfirmar.tsx`
- Já filtra por `destinatario_user_id = user.id` quando Comum — sem mudança necessária.

### Regras técnicas
- Mês de reajuste vem de `getMesReajuste(empresa.data_implantacao)` (já existente em `reajuste-utils`).
- Filtro de responsável usa o mesmo padrão já aplicado em outras telas (Dashboard/Movimentações): `responsavel_user_id` OR `empresa_usuarios`.
- Sem alterações no banco: as RLS de `reajustes_anuais` / `empresas` já permitem leitura ampla; o filtro é client-side e consistente com o resto do app.

### Não fazer
- Não alterar Executivo/Financeiro/Enfermeira.
- Não mexer em RLS.
- Não remover filtros existentes (Ano, Status, Busca).
- Não esconder a barra de KPIs.
