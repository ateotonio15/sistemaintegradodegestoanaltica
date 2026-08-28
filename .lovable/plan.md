# Diferenciar os dois tipos de cobrança retroativa

Exemplo base: NAVEGAÇÃO CIDADE (setembro/2026). A planilha tem:

```text
RELATORIO BENEFICIARIOS   -> mensalidades + linhas "Devolução" / "Cobrança Retroativa"
                             de beneficiários específicos (ex.: -260 x 5 = -1.300)
RESUMO                    -> tabelas dinâmicas por tipo de cobrança
C.RETROATIVA MAI26        -> retroativo de reajuste (136 vidas / 7.072,00)
C.RETROATIVA JUN26        -> 136 / 7.072,00
C.RETROATIVA JUL26        -> 117 / 6.084,00
C.RETROATIVA AGO26        -> 112 / 5.824,00
```

Hoje a conferência soma tudo num único total retroativo, então uma devolução
de beneficiário nunca bate com o valor lançado quando também existem abas de
reajuste (e vice-versa).

## O que muda

### 1. Duas origens distintas na análise da planilha

Separar o total retroativo em dois baldes por bloco/pagador:

- **Reajuste**: linhas vindas de abas cujo nome siga o padrão retroativo
  (`C.RETROATIVA MAI26`, `COB. RETROATIVA MAI26`, `COBRANÇA RETROATIVA MAIO26`
  e variações), além dos pivots de "Cobrança Retroativa <Mês>" no RESUMO.
  Mantém o detalhamento por mês já existente.
- **Beneficiários**: linhas dentro da aba principal (RELATORIO BENEFICIARIOS)
  cujo "Tipo Cobrança" seja Cobrança Retroativa ou Devolução — com quantidade,
  total e lista de beneficiários (nome, matrícula, valor).

O total agregado atual continua existindo, para não quebrar as telas de análise
e o histórico.

### 2. Origem no cadastro da cobrança retroativa

Novo campo obrigatório **Origem** na tela de editar/cadastrar cobrança
retroativa, ao lado do Tipo de lançamento:

- Reajuste (abas C.RETROATIVA da planilha)
- Beneficiários específicos (linhas no relatório de beneficiários)

Lançamentos existentes ficam com origem sugerida automaticamente: devolução →
beneficiários; cobrança → reajuste; o usuário pode corrigir.

### 3. Conferência automática por origem

`Conferir` e `Conferir todas` passam a comparar contra o balde certo:

- Origem "reajuste" → soma das abas retroativas da competência.
- Origem "beneficiários" → soma das linhas retroativas/devolução do relatório
  de beneficiários (comparação em valor absoluto para devolução).

Quando o balde certo não existir na planilha mas o outro existir, o status vira
"Não encontrada" com aviso explicando que só foi localizado o outro tipo
(evita marcar divergência enganosa).

### 4. Feedback visual

- Badge de origem na lista de cobranças retroativas.
- No resultado da conferência, mostrar a fonte usada: nome das abas retroativas
  encontradas com valor por mês, ou a quantidade de beneficiários somados.

## Detalhes técnicos

- `src/lib/excel-analysis-utils.ts`: novos campos no bloco de resultado
  (`retroativasReajuste` e `retroativasBeneficiarios`, ambos com
  quantidade/total e, no primeiro, `mesesDetalhe`), preenchidos onde hoje já se
  acumula `retroQtd/retroTotal` e `devQtd/devTotal`; regex de nome de aba
  normalizada (sem acento, aceitando `C.`/`COB.`/`COBRANCA` + `RETROATIV` +
  mês abreviado ou por extenso + ano de 2 ou 4 dígitos).
- Migração: coluna `origem_retroativo text` em `cobrancas_retroativas` com
  check em ('reajuste','beneficiarios').
- `src/components/financeiro/ReajusteCobrancaRetroativa.tsx`: campo Origem no
  formulário, `buscarRetroativoPlanilha` retornando os dois baldes, e
  `conferirCobranca` escolhendo o balde pela origem.
- Sem alteração nas telas de análise do Faturamento além dos novos campos
  opcionais.
