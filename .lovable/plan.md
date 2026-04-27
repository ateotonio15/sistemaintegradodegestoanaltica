## Objetivo
Transformar o card "Faturamentos Enviado" do Dashboard Cadastro em uma **lista de trabalho ativa**: quando o contrato entra no período correto, ele aparece com o botão **Pendente**. Clicando, o Cadastro anexa documentos e confirma — o Financeiro recebe o alerta e o status muda para **Enviado**.

## Como o sistema decide "está no período"
Reaproveitando o que já existe (`tipo_movimentacao` Diária/Fechada + `periodo_movimentacao` 01-05…25-30 + `data_corte`), as periodicidades pedidas são interpretadas assim, sem mudar o schema da empresa:

- **Mensal** → 1 ciclo no mês, no `periodo_movimentacao` da empresa
- **Quinzenal** → 2 ciclos no mês (ex.: 01-15 e 15-30) — derivado de `periodo_movimentacao`
- **Semanal** → 1 ciclo por semana — usa `data_corte` em modo Diária
- **Bimestral** → ciclo a cada 2 meses, ancorado em `data_implantacao`
- **Personalizado** → cai no comportamento padrão de `tipo_movimentacao`/`periodo_movimentacao` já cadastrado

A regra fica encapsulada em uma função utilitária `contratoDentroDoPeriodo(empresa, hoje)` para podermos evoluir depois sem refatorar o card.

## Fluxo (ASCII)
```text
empresa cadastrada
    │ (cálculo dinâmico no carregamento do card)
    ▼
empresa "dentro do período"?
    │ sim
    ▼
existe movimentacoes(empresa,mes,periodo) com data_envio_financeiro?
    │ não → ITEM aparece na lista com botão [Pendente]
    │ sim → ITEM mostra badge [Enviado / Finalizado]
    ▼
clique no botão Pendente
    ▼
mini-dialog: "Este contrato precisa ser movimentado."
   • upload obrigatório (PDF/Excel/imagem, sem limite)
   • botão "Confirmar envio"
    ▼
ao confirmar:
   • cria/atualiza movimentacoes (data_envio_financeiro = hoje)
   • salva anexos em anexos_movimentacao
   • trigger handle_envio_financeiro dispara → alerta Financeiro
    ▼
status do item vira "Enviado" (e depois "Finalizado" quando o Financeiro envia a nota)
```

## O que muda na UI

**Card "Faturamentos Enviado" (Dashboard Cadastro)**
- Header já existente (BellRing warning + contador) é mantido
- Conteúdo passa a listar **dois grupos**:
  1. **Pendentes** (no topo): empresa, código, mês/período corrente, badge `Pendente` clicável (botão warning) com a mensagem `"Este contrato precisa ser movimentado."` em tooltip/subtexto
  2. **Enviados/Finalizados** (mais abaixo): igual ao atual, com badge verde quando o Financeiro já enviou a nota
- Mensagem vazia quando não há nenhum item

**Mini-dialog "Movimentar contrato"**
- Título: nome da empresa + código + período
- Texto de alerta: *"Este contrato precisa ser movimentado."*
- Bloco de upload (componente `AnexosMovimentacao` já existente, em modo "obrigatório ≥ 1")
- Botão **Confirmar envio** desabilitado até ter pelo menos 1 anexo
- Ao confirmar, faz upsert em `movimentacoes` setando `data_envio_financeiro = hoje`. O trigger `handle_envio_financeiro` cuida do resto (cria registro financeiro, espelha anexos, gera alerta Pendente para o Financeiro).

## Detalhes técnicos

**Frontend**
- `src/lib/movimentacao-utils.ts`: novas funções
  - `contratoDentroDoPeriodo(empresa, hoje): boolean`
  - `periodoVigente(empresa, hoje): { mes_referencia, periodo }` — calcula o ciclo atual conforme as 5 periodicidades acima
- `src/components/dashboard/FaturamentosEnviadosCard.tsx`: reescrito para
  - buscar todas empresas Ativas vinculadas ao usuário (via `empresa_usuarios` + `responsavel_user_id`)
  - filtrar pelas que estão `dentro do período`
  - cruzar com `movimentacoes` do mesmo mês/período para distinguir Pendente vs Enviado vs Finalizado (já cruzado com `financeiro_movimentacoes.data_envio_nota`)
  - renderizar lista agrupada
- `src/components/dashboard/MovimentarContratoDialog.tsx`: novo componente de mini-dialog (Dialog do shadcn) reaproveitando `AnexosMovimentacao` para upload obrigatório
- Realtime continua nas tabelas `movimentacoes` e `financeiro_movimentacoes`

**Backend**
- Nenhuma migração necessária. Schema, triggers (`handle_envio_financeiro`, `handle_finalizar_alerta_financeiro`), bucket `anexos-movimentacoes` e tabela `anexos_movimentacao` já existem
- RLS já permite ao Cadastro inserir/atualizar `movimentacoes` e anexar arquivos de empresas vinculadas

## Não faz parte deste plano
- Adicionar campo "periodicidade" novo ao cadastro de empresa (decisão: reusar o que já existe)
- Mudar a aba `/movimentacoes` ou o Dashboard do Financeiro
- Migração de dados existentes
