# Prévia — PDF de 1 página: Emissão dia 01 · Movimentações 15-30 · Competência 08/2026

## Números conferidos no sistema

Filtro: competência 08/2026, emissão dia 01, períodos 15-20, 20-25 e 25-30, empresas ativas, não suspensas e faturáveis, **excluindo as linhas de primeira mensalidade** (era daí que vinham as duplicidades de KTM 2537 e Fujifilm 2538). Sem separar Diária de Fechada.

| Movimentação | Contratos | Contratos emitidos/enviados | Notas fiscais emitidas |
|---|---|---|---|
| 15-20 | 8 | 8 | 12 |
| 20-25 | 38 | 34 | 71 |
| 25-30 | 100 | 96 | 123 |
| **Total** | **146** | **138** | **206** |

"Notas fiscais emitidas" conta cada NF em PDF anexada na competência — por isso um contrato pode ter várias notas (ex.: Yamaha Motor da Amazônia = 1 contrato e 5 notas, uma por pagador).

## Contratos pendentes — batem 100% com a sua lista (8)

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

Nenhum pendente fora da sua lista; a Technos saiu da lista após o envio de hoje.

## Estrutura do PDF (1 página, modelo da planilha enviada)

1. Texto de abertura ajustado aos números reais: 146 contratos com emissão dia 01 nas movimentações de 15 a 30, dos quais 138 já emitidos e encaminhados às empresas, restando 8 pendentes por exceções específicas.
2. Tabela por movimentação (15-20, 20-25, 25-30) com "Total de contratos" e "Total de notas emitidas", mais linha de total geral (146 contratos / 206 notas).
3. Bloco "Exceções", uma empresa por vez, com as justificativas enviadas: Conver/Hana/Novamed (validação de faturamento e pedido de compra); DETRAN e UEA (análise fiscal dos impostos obrigatórios em órgãos públicos); Centro Educacional Século (tratativa de novo vencimento com a Sra. Tânia); Microsoft (aguardando novo PO anual); Risadinha (carta de distrato por discordância do reajuste, em análise jurídica).
4. Linha final de totais somando movimentações e exceções.

## Detalhes técnicos

- Consulta em `financeiro_movimentacoes` + `empresas`: `mes_referencia = '2026-08'`, `dia_emissao = 1`, períodos 15-20/20-25/25-30, `tipo_lancamento = 'normal'`, empresa Ativa, não suspensa, faturável.
- Emitido/enviado = `data_envio_nota` preenchida; pendente = tudo que não foi enviado (nota emitida, aguardando validação, faturado e em faturamento entram como pendentes).
- Notas fiscais = anexos PDF de mensalidade vinculados à movimentação na competência 2026-08.
- Geração pontual com ReportLab em `/mnt/documents`, A4 retrato, página única, identidade verde SIGA, com QA visual antes da entrega. Nenhuma alteração no código do sistema.
