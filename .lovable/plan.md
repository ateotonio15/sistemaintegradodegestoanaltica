# Detalhes dos contratos implantados na primeira visão

## Objetivo
Ampliar os cartões já existentes da aba de Implantação, sem refazer a tela, para que contratos finalizados exibam o resumo contratual completo no padrão visual atual do SIGA.

## Implementação
- Manter nome, status, exclusão, código e abertura do contrato exatamente como funcionam hoje.
- Quando o status for **Implantado**, substituir o resumo reduzido do cartão pelos dados:
  - data de ativação;
  - dia de vencimento;
  - período de movimentações;
  - e-mails do contrato;
  - telefone;
  - vidas total, enfermaria e apartamento;
  - corretora;
  - agenciamento e percentual vitalício.
- Exibir somente informações preenchidas, usando “—” para campos essenciais ausentes, sem poluir os cartões que ainda estão em andamento.
- Ajustar a grade e a altura dos cartões para comportar o conteúdo, mantendo leitura clara em computador e celular.

## Dados e preenchimento
- Reutilizar os campos atuais para ativação, vencimento, movimentação, telefone, total de vidas, corretora e percentuais.
- Acrescentar ao cadastro do contrato apenas os campos hoje inexistentes: **e-mails do contrato**, **vidas em enfermaria** e **vidas em apartamento**.
- Disponibilizar esses novos campos nas etapas existentes do formulário e no resumo final, sem remover nenhum campo atual.
- Validar que vidas em enfermaria + apartamento sejam coerentes com o total informado.

## Validação
- Conferir um contrato implantado com o exemplo da FUJIFILM e outro contrato ainda em andamento.
- Confirmar que busca, abertura, exclusão e indicadores atuais continuam funcionando.
- Verificar a apresentação em tela larga e celular.
