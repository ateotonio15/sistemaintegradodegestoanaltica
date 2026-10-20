# Roadmap — Primeiro pacote financeiro

## Endereços em Editar Informações
- [x] Acrescentar consulta pública CNPJ.ws junto ao CNPJ no formulário existente e no formulário restrito (CNPJ somente leitura), sem modificar permissões, campos ou endereços. Consulta real autenticada retornou dados; invalidade, carregamento, sucesso, não encontrado e indisponibilidade conferidos com respostas simuladas. Nenhuma gravação; consulta só exibe os dados, mantendo preenchimento manual. Doze testes aprovados (consulta e endereços). Limite da API pública: três consultas por minuto por IP; indisponibilidade mantém cadastro manual.
- [x] Finalizar endereços: permissões atuais verificadas (Executivo já autorizado para endereços; Visualização somente leitura), principal protegido no formulário e no servidor, confirmação Cancelar/Excluir e consulta compacta fora do formulário. Oito testes aprovados; salvar e consultar conferidos com escrita simulada, sem dados fictícios na operação. Não há histórico geral de alterações de campos da empresa para reutilizar; históricos de implantação e prioridade mantidos. Teste com contas específicas de Executivo/Visualização não executado.
- [x] Compactar a visualização com resumos, editor individual e lista recolhível. Conferidos adicionar, editar, cancelar, recolher/expandir e excluir com confirmação, sem salvar dados fictícios; quatro testes aprovados.
- [x] Preservar endereço principal e incluir secundários estruturados no formulário existente.
- [x] Quatro testes aprovados; formulário conferido com sessão real e salvar/reabrir simulados, preservando endereço antigo e dois secundários. Nenhum endereço fictício gravado na operação; persistência real não testada para evitar alterações nos cadastros.

## Reajustes por faixa etária
- [x] Exibir a primeira faixa nos valores de reajuste e disponibilizar todas as faixas no histórico.
- [x] Cinco testes aprovados e histórico real do contrato 2444 conferido: primeira faixa Enfermaria R$ 219,24, Apartamento R$ 306,94 e todas as faixas abertas, sem alterar registros.

## Plantão LSL — 20/10/2026
- [x] Reunir os históricos duplicados da LSL no cartão de outubro, sem apagar registros ou alterar permissões.
- [x] Conferir o plantão de 20/10 na tela com a sessão disponível: 32 plantões e 397 atendimentos preservados.
- [ ] Testar com a conta de Ana: bloqueado por falta de permissão para abrir uma sessão dessa usuária; requer login dela no preview.

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
