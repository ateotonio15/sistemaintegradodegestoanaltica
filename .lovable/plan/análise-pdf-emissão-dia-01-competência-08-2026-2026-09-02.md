# Análise PDF — Emissão dia 01 · Competência 08/2026

## O que foi verificado
- Na competência `2026-08` existem **157 contratos com emissão no dia 01** (`dia_emissao = 1`), o maior grupo da competência.
- Desses, **67 já têm data de envio da nota**, **113 tiveram o faturamento iniciado** e **131 já foram liberados pelo cadastro** (aguardando nota).
- O status exibido na aba Faturamento não é salvo no banco: ele é calculado a partir de nota enviada, anexos (PDF/Excel), exigência de PO/PC, faturamento iniciado, prazo e envio operacional.

## O que será entregue
Um PDF (em /mnt/documents) com a análise completa dos 157 contratos de emissão dia 01 de agosto:

1. **Resumo executivo**: total de contratos, total de vidas/valor quando disponível, e o percentual concluído vs. pendente.
2. **Distribuição por status** (com quantidade e percentual de cada um):
   - Enviada (nota já enviada ao cliente)
   - Nota emitida (PDF anexado, ainda não enviada)
   - Aguardando validação (Excel anexado, empresa exige PO/PC)
   - Faturado (Excel anexado)
   - Em faturamento (usuário iniciou o processo)
   - Fora do prazo
   - Aguardando emissão (cadastro liberou, financeiro ainda não iniciou)
   - Pendente (nada iniciado)
3. **Indicadores de progresso**: % emitidas (PDF anexado ou enviadas), % enviadas, % ainda sem qualquer ação, e o que resta para fechar a competência.
4. **Análise do que falta**: lista dos contratos ainda não emitidos, separando os que já estão em faturamento dos que sequer foram iniciados, com responsável e prazo.
5. **Tabela detalhada** (uma linha por contrato): contrato, empresa, status, data de liberação do cadastro, início do faturamento, data de envio da nota, valor da análise (quando existir) e dentro/fora do prazo.
6. **Totais de valor** por status, usando a análise de cada pagador (mesma base dos relatórios anteriores, respeitando grupos financeiros para não perder valor de contratos agrupados).

## Detalhes técnicos
- Base: `financeiro_movimentacoes` filtrando `mes_referencia = '2026-08'` e `dia_emissao = 1`, com join em `empresas`.
- Status replicado exatamente conforme `calcularStatusFinanceiro` em `src/lib/financeiro-utils.ts`, usando `financeiro_arquivos` (anexos que alteram status), `exige_po_pc` e o envio operacional em `movimentacoes`.
- Valores vindos de `financeiro_analises` (`2026-08`), somando apartamento + enfermaria + inclusões + exclusões da base Excel, com a mesma correção de grupo financeiro aplicada no relatório v2.
- Geração com ReportLab em script pontual, seguida de QA visual página a página. Nenhuma alteração no código do sistema.
