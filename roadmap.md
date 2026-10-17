# Roadmap — Primeiro pacote financeiro

## Registro de Reclamações — pedido atual
- [x] Persistir filtros durante navegação e operações.
- [x] Duplicar com data atual e resoluções reiniciadas; preservar CPF na edição.
- [x] Sugerir classificação via IA com histórico autorizado e confirmação humana.
- [x] Executar regressões e conferir os fluxos na tela sem dados de teste na operação. IA real conferida com empresa fictícia sem histórico; gravações de cadastro/edição interceptadas, CPF preservado e confirmação anterior ao envio comprovada.

- [x] Item 1 — Relatório analítico: completude, selo "legado", consolidado separando validado × com limitação
- [x] Item 2 — PDF: ausência/falha de leitura estruturada (totais anuláveis, falhaLeitura)
- [x] Item 3 — Testes de integração de documentos compartilhados (Previsão + relatório)
- [x] Revisão independente — 6 problemas corrigidos com testes de regressão:
  - [x] Relatório: dedup por hash + identidade do pagador (fatias 600+400 somam 1000)
  - [x] Previsão: consolidação por documento; "não separável" não contamina o conjunto (1000+600+400=2000)
  - [x] Previsão: identidade por nome sem CNPJ; ambiguidade sinalizada, nunca mesclada
  - [x] Relatório: consolidado no mesmo universo filtrado; reatribuição do valor de grupo
  - [x] Completude: exige meta.versao no JSON; registro antigo com categoria numérica = legado
  - [x] PDF: sumPdfTotal preserva ausência/falha (null), nunca zero confirmado
- [x] Item 4 — Conferência visual com mocks concluída em rodada anterior, incluindo cenários 5 e 6; sem gravações na operação. Integração com backend real não verificada.
- [x] Item 5 — Capturas e diff dos cenários 5 e 6 entregues na rodada anterior.
