## Objetivo
Ampliar `src/lib/faturamento-exclusoes.ts` (usado no card "Adicionar Exclusões ao faturamento") para:
1. Padronizar nome do plano.
2. Preencher CNPJ do pagador cruzando com o arquivo bruto.
3. Calcular valor proporcional NEGATIVO da exclusão com base na mensalidade detectada no próprio bruto.

Nenhuma mudança de schema, apenas lógica no arquivo `.ts` de mesclagem.

---

## 1. Normalização do Plano

Ao ler cada linha (bruto e exclusão), aplicar:
- Se contém `master executivo` (case-insensitive) → `"Master Executivo"`
- Se contém `coletivo empresarial master` → `"Coletivo Empresarial Master"`
- Remover qualquer sufixo `- Protocolo ANS: XXXXX`.

Aplicar tanto nas linhas do bruto (regravar coluna Plano) quanto nas novas linhas de exclusão.

## 2. CNPJ do pagador (nas exclusões)

Antes do merge, construir mapa `pagadorNormalizado → CNPJ` a partir das linhas do bruto:
- Chave: nome do pagador normalizado (upper, sem acento, sem "PJ - ", trim).
- Valor: CNPJ da mesma linha.

Ao gerar cada linha de exclusão, após obter o `Pagador` (do `SUBESTIPULANTE` sem "PJ - "), procurar no mapa e preencher a coluna `CNPJ` do bruto.

## 3. Detecção automática dos valores de mensalidade

Percorrer o bruto e, para cada linha cujo `Tipo Cobrança` seja `Mensalidade` (ou similar — normalizar), agrupar por plano normalizado e coletar o valor. Escolher o **valor mais frequente (moda)** por plano para blindar contra proporcionais/reajustes.

Resultado: `Map<PlanoNormalizado, number>` (ex.: `Master Executivo → 362.41`, `Coletivo Empresarial Master → 258.87`). Se um plano não for encontrado, o valor da exclusão fica vazio (não quebrar).

## 4. Cálculo do proporcional

Para cada linha de exclusão:
1. Ler `Dt_rescisão` (`DT_RESCISAO` na exclusão). Se ausente/ inválida → valor vazio.
2. `diasNoMes` = total de dias do mês da rescisão (28/29/30/31).
3. `diasProporcionais` = `diasNoMes - dia_rescisao + 1` (inclui o dia da rescisão — 27→30 = 4 dias, conforme exemplo).
4. `mensalidade` = valor detectado para o plano da linha.
5. `valor = -1 * (mensalidade / diasNoMes) * diasProporcionais`, arredondado a 2 casas **só no final** (`Math.round(v*100)/100`).
6. Gravar na coluna `Valor` do bruto (como número, não string, para preservar formato).

## 5. Ajustes de output

- Manter regras já existentes (Tipo Cobrança="Exclusão", Competência = mês anterior, Fx Etária replicada, formatação de datas como texto `DD/MM/YYYY`, sem aba Resumo).
- Novo: normalização do Plano aplicada também às linhas originais do bruto na aba final (reescrever coluna Plano linha a linha).

---

## Arquivo alterado
- `src/lib/faturamento-exclusoes.ts` — adiciona:
  - `normalizarPlano(s)`
  - `construirMapaCNPJ(aoaBruto, headers)`
  - `detectarMensalidadesPorPlano(aoaBruto, headers)`
  - `calcularProporcionalExclusao(mensalidade, dtRescisao)`
  - integração no loop de geração das linhas + reescrita da coluna Plano do bruto.

## Fora de escopo
- UI do modal (nada muda visualmente).
- Persistência em banco / configuração por empresa (detecção é 100% via arquivo bruto).