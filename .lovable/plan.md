# Memória temporária de navegação — aba Financeiro

## Objetivo
Manter, durante a sessão atual, o estado de navegação do usuário na aba **Financeiro** (competência, período, filtros, busca, status, etc.) para que ele volte ao mesmo ponto ao alternar entre abas. Limpar tudo no logout.

## Escopo
- Sem alteração em regras de negócio, queries, anexos, análise, histórico, exportação ou iniciar faturamento.
- Apenas persistência temporária de estado de UI via `sessionStorage`.
- Foco principal: `src/pages/Financeiro.tsx`. Mesmo padrão pode ser aplicado depois a outras telas, sem mudar nada agora.

## Estados a persistir (Financeiro)
- `mes` (competência selecionada)
- `filtroPeriodo`
- `filtroStatus`
- `filtroTipo`
- `somenteOverdue`
- `busca`
- `expandedRowId` (linha aberta, se houver)

Estados efêmeros (dialogs abertos, exportando, resultados de análise em memória, edição) **não** serão persistidos.

## Implementação

### 1. Hook utilitário `useSessionState`
Criar `src/hooks/useSessionState.ts`:
- Assinatura: `useSessionState<T>(key: string, initial: T | (() => T))`.
- Lê de `sessionStorage` na primeira renderização (lazy init), com `try/catch` e fallback ao valor inicial.
- Grava em `sessionStorage` (JSON) sempre que o valor muda, com debounce simples via `useEffect`.
- Comportamento idêntico ao `useState` para não exigir refactor das telas.

### 2. Usar no `Financeiro.tsx`
Substituir os `useState` listados acima por `useSessionState`, com uma chave única por campo sob um prefixo, por exemplo:
- `financeiro:mes`
- `financeiro:filtroPeriodo`
- `financeiro:filtroStatus`
- `financeiro:filtroTipo`
- `financeiro:somenteOverdue`
- `financeiro:busca`
- `financeiro:expandedRowId`

Regra 1 (primeira visita na sessão): se não houver valor salvo, usa o default atual (`getCurrentMesReferencia()`, `"all"`, `null`, `false`, `""`).

Nenhuma outra lógica do arquivo é alterada.

### 3. Limpeza no logout
Em `src/hooks/useAuth.tsx`, dentro de `signOut` (antes do `supabase.auth.signOut()`), remover todas as chaves com prefixo `financeiro:` do `sessionStorage`. Implementar como helper `clearSessionNamespace("financeiro")` no próprio hook utilitário para reuso futuro.

Também limpar quando `onAuthStateChange` emitir `SIGNED_OUT`, como rede de segurança.

### 4. Sessão de navegador
`sessionStorage` já atende às regras 4 e 5 (limpa ao fechar o navegador / nova sessão), sem código adicional.

## Arquivos afetados
- `src/hooks/useSessionState.ts` (novo)
- `src/pages/Financeiro.tsx` (trocar 7 `useState` por `useSessionState`)
- `src/hooks/useAuth.tsx` (limpar namespace `financeiro:` no logout e em `SIGNED_OUT`)

## Validação
1. Selecionar maio/2026 + filtro "Fora do prazo" → ir para Empresas → voltar: estado preservado.
2. Logout → login: volta ao padrão (junho/2026, sem filtros).
3. Fechar e reabrir o navegador: volta ao padrão.
4. Funcionalidades existentes (anexos, análise, histórico, exportação, iniciar faturamento) continuam funcionando — só a fonte do estado mudou.
