# Relatório PDF de Faturamento — versão completa com filtros

Hoje o botão "Relatório PDF" na aba Faturamento gera uma análise simples usando apenas as linhas já filtradas na tela (uma competência por vez, sem valores). A evolução transforma isso em um relatório analítico configurável, no mesmo nível da análise feita para "Emissão dia 01 · 08/2026", porém com mais opções.

## Novo diálogo de filtros

Ao clicar em "Relatório PDF" abre um diálogo com:

- **Competências** (multi-seleção): uma ou várias, ex. 07/2026 + 08/2026.
- **Dias de emissão** (multi-seleção 01–31 + "Sem dia definido"), com atalhos "Todos" e "Somente dia 01".
- **Tipos de movimentação** (multi): Diária, Fechada, e demais valores existentes nas empresas.
- **Período de corte** (multi): lista dinâmica dos períodos presentes nas competências escolhidas.
- **Status** (multi): Enviada, Nota emitida, Aguardando validação, Faturado, Em faturamento, Fora do prazo, Aguardando nota, Pendente.
- **Responsável / usuário que iniciou o faturamento** (multi, opcional).
- **Opções**: incluir valores das análises, incluir tabela detalhada, incluir seção "o que falta".

Padrão do diálogo: competência atual da tela, todos os dias, todos os tipos, todos os status. Um botão "Usar filtros da tela" replica o que já está aplicado na aba.

## Conteúdo do PDF

1. **Capa/cabeçalho** com logo SIGA, competências e resumo dos filtros aplicados.
2. **Resumo executivo**: contratos analisados, vidas somadas, valor total analisado, % concluído x pendente.
3. **Distribuição por status**: quantidade, % e valor por status (todos os 8 status).
4. **Indicadores de progresso**: % emitidas (PDF anexado ou enviadas), % enviadas, % sem qualquer ação, saldo para fechar a competência.
5. **Quebras analíticas** (novas):
   - por competência (quando mais de uma for escolhida);
   - por dia de emissão;
   - por tipo de movimentação (Diária/Fechada);
   - por período de corte;
   - por responsável / quem iniciou o faturamento (produção e pendências).
6. **O que falta emitir**: separando "já em faturamento" de "não iniciado", com responsável, data de liberação do cadastro, início do faturamento e vencimento.
7. **Prazo**: dentro x fora do prazo, com contratos vencidos destacados.
8. **Tabela detalhada** (1 linha por contrato): contrato, empresa, competência, dia de emissão, tipo, período, status, liberação do cadastro, início do faturamento, envio da nota, vencimento, anexos, valor da análise, dentro/fora do prazo.
9. **Totais de valor por status** e total geral.

## Detalhes técnicos

- Base: `financeiro_movimentacoes` (join `empresas`), filtrando `mes_referencia IN (competências)` e `dia_emissao IN (dias)`, mantendo os filtros vigentes da aba (empresa ativa, faturável, não `nao_faturado_financeiro`).
- Status calculado exatamente por `calcularStatusFinanceiro` (`src/lib/financeiro-utils.ts`), com `financeiro_arquivos`, `exige_po_pc` e o envio operacional em `movimentacoes` — nenhum status novo é inventado.
- Valores vindos de `financeiro_analises` (apartamento + enfermaria + inclusões + exclusões), respeitando grupos financeiros para não perder valor de contratos agrupados, como na versão v2 dos relatórios anteriores.
- Quando o relatório abranger mais de uma competência ou dias fora da tela, os dados são buscados diretamente no backend em lote (com paginação para passar do limite de 1.000 linhas), em vez de reaproveitar apenas `filteredRows`.
- Novo componente `src/components/financeiro/RelatorioAnaliseDialog.tsx` para os filtros; `src/lib/financeiro-relatorio-analise-pdf.ts` reescrito para receber o conjunto completo de opções e seções; `src/pages/Financeiro.tsx` apenas abre o diálogo.
- Geração continua com jsPDF + jspdf-autotable (paisagem A4, verde SIGA, paginação), com opção de também exportar o mesmo conteúdo em Excel numa etapa futura.
