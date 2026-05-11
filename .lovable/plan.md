## Objetivo

No card "Faturamentos Não Enviados" (Dashboard do Cadastro/Admin), exibir apenas as empresas cujo ciclo vigente HOJE corresponde ao mês atual E ao período de movimentação configurado da empresa. Hoje o card já filtra por `mes_referencia = mês atual`, mas mostra qualquer `periodo` existente em `financeiro_movimentacoes` — independente da empresa estar de fato no período corrente.

## Comportamento esperado

Cada linha do card só aparece se:

- `mes_referencia` da movimentação financeira = mês atual (já existe), e
- `periodo` da movimentação financeira = período vigente da empresa, calculado por `periodoVigente(empresa)` (regra unificada já usada no projeto):
  - Empresa Diária → período derivado de `data_corte`
  - Empresa Fechada → `periodo_movimentacao`
- Empresa precisa estar ativa (já filtrado em `empresaIdsVinculadas`).

Ou seja: respeita o "filtro de movimentação" da empresa, mostrando somente o ciclo que está rodando agora.

## Mudanças

Arquivo único: `src/components/dashboard/FaturamentosEnviadosCard.tsx`

1. Estender o select de `empresas` na query `faturamentos-empresa-ids-vinculadas` para também trazer os campos necessários ao cálculo do período vigente: `tipo_movimentacao, periodo_movimentacao, data_corte, data_implantacao`. Manter o retorno como apenas `id[]` (para não impactar as outras queries) e armazenar separadamente um Map `empresaId -> { tipo_movimentacao, periodo_movimentacao, data_corte, data_implantacao, status_empresa }` via uma segunda query leve OU mudar essa query para retornar o array completo e derivar `empresaIdsVinculadas` via `useMemo`.
   - Implementação preferida: trocar a query existente para retornar `EmpresaConfig[]` (com os campos necessários) e expor `empresaIdsVinculadas` via `useMemo` filtrando ativas.

2. Calcular, via `useMemo`, um `Map<empresaId, periodoVigente>` chamando `periodoVigente(emp)` de `@/lib/movimentacao-utils`.

3. No `useMemo` de `linhas` (ou logo após receber `pendentes`), filtrar:
   ```ts
   const vigente = vigenteMap.get(p.empresa_id);
   if (!vigente) return null;
   if (p.periodo !== vigente.periodo) return null;
   ```
   (O filtro de `mes_referencia` já é feito na query.)

4. Sem mudanças em RLS, banco, RPCs, realtime, alertas, ou no fluxo do botão "Alertar Financeiro".

## Não fazer

- Não alterar o card do Financeiro ("Notas a Enviar").
- Não alterar regras de período/cálculo já existentes em `movimentacao-utils.ts`.
- Não tocar no banco nem em policies.