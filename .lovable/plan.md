# Prévia — PDF de 1 página: Emissão dia 01 · Movimentações 15-30 · Competência 08/2026

## Conferência dos números (dados reais do sistema)

Filtro: competência 2026-08, emissão dia 01, períodos 15-20, 20-25 e 25-30, empresas ativas, não suspensas e faturáveis. "Emitida/enviada" = movimentação com data de envio da nota.

| Movimentação | Contratos | Notas emitidas | Pendentes |
|---|---|---|---|
| Diária 15-20 | 5 | 5 | 0 |
| Diária 20-25 | 23 | 21 | 2 |
| Diária 25-30 | 34 | 33 | 1 |
| Fechada 15-20 | 3 | 3 | 0 |
| Fechada 20-25 | 15 | 12 | 3 |
| Fechada 25-30 | 68 | 65 | 3 |
| **Total** | **148** | **139** | **9** |

Diferença em relação ao seu texto: o sistema mostra **148 contratos** (não 147) e **9 pendentes** (não 8). As notas emitidas batem: **139**.

## Contratos pendentes encontrados

Batem com a sua lista (8):
1. CONVER EMBALAGENS (2523) — Fechada 25-30
2. HANA ELECTRONICS (2455) — Fechada 25-30
3. NOVAMED (2477) — Diária 20-25
4. DETRAN-AM (2467) — Fechada 20-25
5. UEA (2496) — Fechada 20-25
6. CENTRO EDUCACIONAL SECULO (2457) — Fechada 20-25
7. MICROSOFT MOBILE (485) — Diária 25-30
8. RISADINHA (2432) — Fechada 25-30

Um a mais, sem justificativa informada:
9. **TECHNOS DA AMAZONIA (680) — Diária 20-25**, sem data de envio da nota (faturamento iniciado, liberado pelo cadastro).

Preciso saber o que fazer com a Technos: informar o motivo dela, tratá-la como "em conclusão de tratativas" genérico, ou confirmar que ela deve ser considerada já emitida (nesse caso o número passa a 148/140).

## Estrutura do PDF (1 página, modelo da planilha enviada)

1. Texto de abertura, ajustado aos números reais: total de contratos com emissão dia 01 das movimentações 15-30, quantos já emitidos e encaminhados, quantos pendentes.
2. Tabela por movimentação: linha para 15-20, 20-25 e 25-30, com "Total de contratos" e "Total de notas emitidas" (Diária e Fechada somadas por período, com subtotal visível).
3. Bloco "Exceções": uma empresa por vez, com a explicação enviada (Conver/Hana/Novamed; DETRAN e UEA; Centro Educacional Século; Microsoft; Risadinha).
4. Linha final de totais: total de contratos e total de notas emitidas somando movimentações e exceções.

## Detalhes técnicos

- Consulta em `financeiro_movimentacoes` + `empresas` (mês 2026-08, `dia_emissao = 1`, períodos 15-20/20-25/25-30, `status_empresa = 'Ativa'`, não suspenso, faturável).
- Pendente = sem `data_envio_nota` (inclui "nota emitida", "aguardando validação", "faturado" e "em faturamento"), conforme a nova regra.
- Geração pontual com ReportLab em `/mnt/documents`, layout de página única em A4 retrato, verde SIGA, com QA visual antes da entrega. Nenhuma alteração no código do sistema.
