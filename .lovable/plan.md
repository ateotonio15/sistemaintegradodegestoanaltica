# Prévia — PDF de 1 página: Emissão dia 01 · Movimentações 15-30 · Competência 08/2026

## Números conferidos no sistema

Filtro: competência 08/2026, emissão dia 01, períodos 15-20, 20-25 e 25-30, empresas ativas, não suspensas e faturáveis. Sem separar Diária de Fechada.

| Movimentação | Contratos | Contratos emitidos/enviados | Notas fiscais emitidas |
|---|---|---|---|
| 15-20 | 8 | 8 | 12 |
| 20-25 | 38 | 34 | 71 |
| 25-30 | 102 | 98 | 126 |
| **Total** | **148** | **140** | **209** |

- "Notas fiscais emitidas" conta cada NF em PDF anexada na competência (ex.: Yamaha Motor da Amazônia = 1 contrato e 5 notas, uma por pagador).
- A Technos já entrou como enviada, então os pendentes caíram para **8**.
- Duplicidade encontrada: KTM DO BRASIL (2537) e FUJIFILM DO BRASIL (2538) têm duas movimentações cada no período 25-30 desta competência. Contando contratos únicos o total vira **146 contratos / 138 enviados / 8 pendentes**. O PDF será gerado por contratos únicos, salvo indicação em contrário.


## Contratos pendentes — batem 100% com a sua lista

| Contrato | Empresa | Movimentação |
|---|---|---|
| 2523 | Conver Embalagens da Amazônia | 25-30 |
| 2455 | Hana Electronics | 25-30 |
| 2477 | Novamed | 20-25 |
| 2467 | DETRAN-AM | 20-25 |
| 2496 | UEA | 20-25 |
| 2457 | Centro Educacional Século | 20-25 |
| 485 | Microsoft Mobile Tecnologia | 25-30 |
| 2432 | Risadinha | 25-30 |

Nenhum contrato pendente fora da sua lista, e nenhum nome da sua lista de fora da apuração.

## Estrutura do PDF (1 página, modelo da planilha enviada)

1. Texto de abertura ajustado aos números reais: 148 contratos com emissão dia 01 nas movimentações de 15 a 30, dos quais 140 já emitidos e encaminhados às empresas, restando 8 pendentes por exceções específicas.
2. Tabela por movimentação (15-20, 20-25, 25-30) com "Total de contratos" e "Total de notas emitidas", mais linha de total geral (148 / 209 notas).
3. Bloco "Exceções", uma empresa por vez, com as justificativas enviadas: Conver/Hana/Novamed (validação e PO do cliente); DETRAN e UEA (análise fiscal de impostos de órgãos públicos); Centro Educacional Século (tratativa de novo vencimento com a Sra. Tânia); Microsoft (aguardando novo PO anual); Risadinha (distrato por discordância do reajuste, em análise jurídica).
4. Linha final de totais somando movimentações e exceções.

## Detalhes técnicos

- Consulta em `financeiro_movimentacoes` + `empresas` (mês 2026-08, `dia_emissao = 1`, períodos 15-20/20-25/25-30, empresa Ativa, não suspensa, faturável).
- Emitido/enviado = `data_envio_nota` preenchida; pendente = tudo que não foi enviado (inclui nota emitida, aguardando validação, faturado e em faturamento).
- Notas fiscais = anexos PDF de mensalidade vinculados à movimentação na competência 2026-08.
- Geração pontual com ReportLab em `/mnt/documents`, A4 retrato, página única, identidade verde SIGA, com QA visual antes da entrega. Nenhuma alteração no código do sistema.
