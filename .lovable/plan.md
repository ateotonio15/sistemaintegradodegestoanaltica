# Leitura da DANFSe v2.0 (nota nacional nova)

## O que está errado hoje
Na nota 15099 da Metalúrgica Sete de Setembro, o sistema acusou "ISSQN Retido R$ 207.253,04 deveria ser igual ao ISSQN Apurado R$ 0,00". Os dois valores estão errados. O certo é ISSQN retido de R$ 829,01, igual ao apurado, e portanto não há divergência.

## Como a regra antiga lê a nota (modelo anterior da DANFSe)
Ela espera o bloco de totais assim:

```text
Valor do Serviço | Desc. Cond. | Desc. Incond. | ISSQN Retido
Total Ret. Federais | PIS/COFINS | Valor Líquido
```

Ela pega todos os valores em R$ desse bloco e usa a posição de cada um: o 1º é o serviço, o 2º é o ISSQN retido e o último é o valor líquido. No bloco de ISSQN, ela lê os valores que aparecem depois de "BC ISSQN" e também usa a posição de cada um.

## Por que falha na versão nova (v2.0)
O bloco de totais agora é:

```text
VALOR DA OPERAÇÃO        R$ 207.253,04
Total das Retenções      R$ 829,01
VALOR LÍQUIDO DA NFS-e   R$ 206.424,03
Total do IBS/CBS         R$ 0,00
LÍQUIDO + IBS/CBS        R$ 0,00   (impresso zerado)
```

- O último valor passou a ser "Líquido + IBS/CBS", que vem zerado. O sistema lê esse campo como líquido, fica com R$ 0,00 e calcula o retido como 207.253,04 − 0 = R$ 207.253,04.
- No bloco de ISSQN, a v2.0 separa em linhas diferentes "Total Deduções" (165.802,43), "BC ISSQN" (41.450,61), "Retenção: Retido pelo Tomador" e "ISSQN Apurado" (829,01). Contar os valores por posição pega linhas vizinhas e dá o apurado como R$ 0,00.

## Como vai ficar
1. **Identificar a versão.** O sistema reconhece a v2.0 pelos rótulos "VALOR DA OPERAÇÃO / SERVIÇO", "Total das Retenções" e "IBS/CBS". Se não achar esses rótulos, usa a regra antiga, que continua valendo para as notas do modelo anterior.
2. **Ler pela coluna.** Na v2.0, cada valor é lido na mesma coluna do seu rótulo, na linha logo abaixo, e não pela ordem em que aparece:
   - Valor do serviço: 207.253,04
   - Total das retenções: 829,01
   - Valor líquido: 206.424,03
   - Total de deduções: 165.802,43
   - Base do ISSQN: 41.450,61
   - Alíquota: 2,00%
   - ISSQN apurado: 829,01
   - Retenção: "Retido pelo Tomador"
3. **ISSQN retido.** Quando a nota diz "Retido pelo Tomador", o retido é o ISSQN apurado, conferido com "Total das Retenções" quando não há retenção federal. Quando diz "Não Retido", o retido fica vazio.
4. **Campos que não entram na conta.** "Líquido + IBS/CBS" zerado nunca é usado como valor líquido. O valor de 829,01 que aparece de novo no bloco IBS/CBS não é somado outra vez.
5. **Conferências.** Serviço − retenções tem que dar o líquido (207.253,04 − 829,01 = 206.424,03). Se não der, aparece um alerta, e a nota não é alterada.
6. **Resultado nesta nota.** Retido e apurado ficam iguais, em R$ 829,01, e o aviso de divergência some. A comparação dos beneficiários e mensalidades continua como está hoje.

## Validação
- Testar a leitura com o PDF anexado e comparar com os valores da sua explicação.
- Testar também uma nota antiga já anexada, para confirmar que o modelo anterior continua funcionando.
- Depois, basta clicar em "Reanalisar" nos contratos com nota v2.0.

## Detalhes técnicos
- Arquivo: `src/lib/pdf-analysis-utils.ts`, na leitura dos blocos "VALOR TOTAL DA NFS-e" e "TRIBUTAÇÃO MUNICIPAL".
- Criar um leitor v2 que usa as posições x dos itens do pdf.js. Cada rótulo de cabeçalho é ligado ao valor mais próximo na mesma coluna, na linha seguinte.
- Novo campo opcional `layoutDanfse: "v1" | "v2"` e `totalRetencoes`. A lógica de divergências usa esses campos sem mudar as outras regras.
