# Plano

## 1) Exibir "Contratos a Vigenciar" no Dashboard do Financeiro

Hoje o card `ContratosAVigenciarCard` aparece apenas no Dashboard geral. O Financeiro precisa ver os mesmos contratos novos + anexos (Anexo 1, contrato, etc.) para gerar a primeira nota.

- Reutilizar o componente `ContratosAVigenciarCard` em `src/components/dashboard/DashboardFinanceiro.tsx`, colocando-o numa seção própria (ex.: acima de "Faturamentos Enviados / Vencimento").
- A RLS atual já permite leitura: a policy `Scoped read impl anexos` em `implantacao_anexos` inclui o role `financeiro`, então o Financeiro consegue ver e baixar os anexos sem novas migrations.
- No card, o Financeiro **não** deve poder anexar/excluir. A flag `canManage` já é `isAdmin || comum || administradoras || vendas` — o Financeiro entra automaticamente como visualização. Não há mudança necessária.

## 2) Não incluir contratos novos na movimentação do mês se a vigência já passou do período

Hoje:
- `Dashboard.handleGenerateAll` (provisiona `movimentacoes` operacionais) só checa `status_empresa === "Ativa"` — não olha `data_implantacao`.
- `Financeiro.provisionarMutation` (provisiona `financeiro_movimentacoes`) também não olha `data_implantacao`.

Regra nova (aplicada nos dois provisionamentos):
- Para cada empresa com `data_implantacao` definida:
  - Se `data_implantacao` está **depois** do mês de referência → pula (já é tratado implicitamente, mas explicitar).
  - Se `data_implantacao` está **dentro** do mês de referência e seu dia é **maior** que o dia final do período da empresa (ex.: vigência 20/05, período `10-15`, fim do período = 15) → pula a geração desse mês. A movimentação só será criada a partir do mês subsequente.
  - Se `data_implantacao <= dia final do período` no mês de referência → gera normalmente.
- Para período `Diária` (data_corte): mesma lógica usando o fim do período derivado via `periodoDaDataCorte(emp.data_corte)`.

Aplicar a checagem:
- `src/pages/Dashboard.tsx` em `handleGenerateAll` antes do `toInsert.push(...)`.
- `src/pages/Financeiro.tsx` em `provisionarMutation` antes do `periodos.add(base)` (apenas para o caminho "Ativa" e quando há `data_implantacao`).

## Detalhes técnicos

- Mapa de fim de período (já existe em `DashboardFinanceiro.tsx`):
  ```ts
  const PERIODO_FIM = { "01-05":5, "05-10":10, "10-15":15, "15-20":20, "20-25":25, "25-30":30 };
  ```
  Centralizar/importar em `src/lib/movimentacao-utils.ts` ou duplicar localmente nos dois arquivos (a versão mínima é duplicar para manter o escopo da mudança).
- Helper:
  ```ts
  function vigenciaDentroDoPeriodo(dataImplantacao, mesRef, periodo) {
    if (!dataImplantacao) return true;
    const [yi, mi, di] = dataImplantacao.split("-").map(Number);
    const [yr, mr] = mesRef.split("-").map(Number);
    if (yi > yr || (yi === yr && mi > mr)) return false; // implantação em mês futuro
    if (yi < yr || (yi === yr && mi < mr)) return true;  // implantação em mês anterior
    return di <= (PERIODO_FIM[periodo] ?? 31);            // mesmo mês: respeita dia
  }
  ```

## Arquivos afetados
- `src/components/dashboard/DashboardFinanceiro.tsx` — incluir `<ContratosAVigenciarCard />`.
- `src/pages/Dashboard.tsx` — filtro de vigência em `handleGenerateAll`.
- `src/pages/Financeiro.tsx` — filtro de vigência em `provisionarMutation`.

Sem migrations / sem mudanças de RLS.
