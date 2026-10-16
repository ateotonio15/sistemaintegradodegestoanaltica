# Roadmap — Primeiro pacote financeiro

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
- [~] Item 4 — Conferência visual executada com fixtures via interceptação de rede nas telas reais (backend não é isolado da operação — mocks, sem registros criados). Cenários 1,2,3,4,7,8 verificados no PDF exportado; 5 e 6 não verificados visualmente (cobertos por testes). Falha de apresentação corrigida: zero válido aparecia "—" na tabela detalhada; logo PNG inválido derrubava a geração do PDF.
- [ ] Item 5 — Entrega: diff completo, matriz, limitações, roteiro manual
