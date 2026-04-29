## Objetivo

Dois ajustes pontuais e isolados na aba **Financeiro**, sem impacto em outras áreas:

1. Tornar **"Enviada"** o estágio final do Financeiro (passa a ter prioridade máxima sobre "Nota emitida" e "Faturado").
2. Fazer o parser de Excel padrão (usado por WINLOGIS e demais contratos `normal`/`faixa_etaria`) **detectar e exibir Exclusões**, da mesma forma que já acontece com Inclusões.

---

## 1. Reordenar prioridade do Status Financeiro

### Comportamento atual
A função `calcularStatusFinanceiro` (em `src/lib/financeiro-utils.ts`) hoje devolve:

```
1º Nota emitida  (existe PDF)
2º Faturado      (existe XLS)
3º Enviada       (data_envio_nota preenchida)
4º Fora do prazo
5º Aguardando nota
6º Pendente
```

### Comportamento desejado
"Enviada" representa a **confirmação final** do envio da nota e deve vencer qualquer outra detecção:

```
1º Enviada       (data_envio_nota preenchida)  ← novo topo
2º Nota emitida  (existe PDF)
3º Faturado      (existe XLS)
4º Fora do prazo
5º Aguardando nota
6º Pendente
```

### Mudança técnica
Em `src/lib/financeiro-utils.ts → calcularStatusFinanceiro`, mover o bloco
`if (mov.data_envio_nota) return "Enviada";` para antes das checagens de PDF/XLS.
Comentário JSDoc e a lista de prioridades acima da função devem ser atualizados para refletir a nova ordem. Nenhum outro arquivo precisa ser tocado — a cor da badge `Enviada` (verde sucesso) já está definida em `statusFinanceiroColor`.

---

## 2. Detectar Exclusões no parser Excel padrão

### Diagnóstico
O parser `analisarExcelFinanceiro` (em `src/lib/excel-analysis-utils.ts`), usado por contratos com `tipo_analise = "normal"` ou `"faixa_etaria"` (caso da WINLOGIS), **não trata exclusões**:

- O `AnaliseResultado` permite o campo opcional `exclusoes`, mas só o parser **Moto Honda** preenche esse campo.
- No parser padrão, qualquer linha com Tipo Cobrança = "Exclusão" cai no `classificarPlano()`, retorna `null` (porque o nome do plano não bate) e é simplesmente ignorada.
- Resultado visível: na tela de análise da WINLOGIS aparece somente a linha "Enfermaria"; nenhuma linha "Exclusões" é exibida, mesmo quando o arquivo tem exclusões.

### Solução
Espelhar o tratamento já existente para Inclusões dentro de `analisarExcelFinanceiro`:

1. Adicionar uma função auxiliar `isExclusao(tipo)` análoga a `isInclusao` (aceita variações: "exclusao", "exclusão", "excluido", "exclusao prorata", etc.).
2. No loop principal de linhas, **antes** da chamada a `classificarPlano`, checar:
   - se `isInclusao(tipoCell)` → soma em `inclusoes` (já existe).
   - se `isExclusao(tipoCell)` → soma em uma nova variável local (`excQtd`, `excTotal`); o valor é tratado como **negativo** (se a planilha já trouxer negativo, mantém; se vier positivo, inverte o sinal para sinalizar saída).
3. Devolver `exclusoes: { quantidade: excQtd, total: excTotal }` no objeto final, somente quando `excQtd > 0` ou `excTotal !== 0`. Quando não há exclusões, omitir o campo (mantém compatibilidade com o tipo opcional).

### Reflexo na UI
`AnaliseExcelRow.tsx` já possui um bloco que renderiza a linha "Exclusões" (`destaqueNegativo: true`) quando `r.exclusoes` está presente — não precisa de mudança. Assim que o parser passar a popular o campo, a linha aparece automaticamente na tabela de análise, e o "Total Geral" passa a considerar o valor negativo das exclusões (já é um simples `reduce`).

### Impacto na comparação Excel × PDF
Para `tipo_analise = "normal"` a comparação usa `compararExcelComPdf`, que hoje **não compara exclusões** (só enfermaria, apartamento e inclusões). Manter esse comportamento — não estamos pedindo validação cruzada de exclusões no fluxo padrão; apenas exibição da linha. A comparação simplificada do Moto Honda continua intacta.

### Impacto em "A Receber" e exportação PRÊMIO
Como `analisarExcelFinanceiro` agora pode devolver `exclusoes`, o cálculo do "A Receber" automático (que toma como base os totais da análise) passa a refletir corretamente o líquido (Enfermaria + Apartamento + Inclusões − |Exclusões|). Isso já é o comportamento correto/esperado pelo Financeiro; nenhuma mudança adicional é necessária em `premio-export.ts` ou no fluxo de geração de A Receber, que apenas consomem o `total` agregado.

---

## Arquivos afetados

- `src/lib/financeiro-utils.ts` — reordenar prioridade do status.
- `src/lib/excel-analysis-utils.ts` — adicionar detecção/somatório de Exclusões em `analisarExcelFinanceiro`.

Nenhuma migration, nenhum schema, nenhuma outra área do sistema é tocada.

---

## Validação após implementação

1. Reanalisar uma movimentação WINLOGIS com exclusões: linha "Exclusões" deve aparecer com valor negativo e "Total Geral" deve refletir o líquido.
2. Em uma movimentação com `data_envio_nota` preenchida E anexos PDF/XLS, o badge passa a mostrar **Enviada** (verde), não mais "Nota emitida"/"Faturado".
3. Movimentações sem `data_envio_nota` continuam mostrando "Nota emitida" quando há PDF e "Faturado" quando há apenas XLS.
4. Análise Moto Honda permanece idêntica (já tem seu próprio parser).
