## Painel "Previsão financeira" — colunas detalhadas por categoria

Apenas o componente `src/components/dashboard/PrevisaoFinanceira.tsx`. Nada muda em regras, banco, aba Financeiro, vencimento ou prorrogação.

### 1. Estrutura de dados (`AnaliseDado`)
Substituir os campos agregados (`total`, `beneficiarios`, `mensalidade`, `categorias`) por valores por categoria, vindos da soma de `AnaliseResultado` em todas as planilhas/pagador da linha:

```
enfBeneficiarios, enfTotal
aptBeneficiarios, aptTotal
inclusoesTotal
exclusoesTotal     // soma de res.exclusoes?.total (Moto Honda; vem negativo)
totalGeral         // enfTotal + aptTotal + inclusoesTotal + exclusoesTotal
                   // (exclusoes já é negativa → equivale a "+ inclusões − exclusões")
```

Manter `loading`, `erro` e `detalhe` (usado pelo painel expansível).

### 2. Cabeçalho da tabela
Trocar as colunas atuais (Categoria / Beneficiários / Mensalidade / Total) por:

```
Empresa | Pagador | Competência |
Benef. Enfermaria | Mensalidade Enfermaria |
Benef. Apartamento | Mensalidade Apartamento |
Inclusões | Exclusões | Total |
Vencimento original | Prorrogação | Status
```

Renderização:
- Beneficiários: número ou `—` se 0.
- Valores R$: `BRL(valor)` quando > 0, senão `—` (alinhado à direita, tabular-nums).
- Exclusões: exibir em vermelho quando ≠ 0; valor exibido como `BRL(Math.abs(exc))` precedido de `−`.
- Total: `text-success font-semibold` (já é hoje).
- Vencimento original e Prorrogação: sem mudança (preservados).
- Atualizar `colSpan` dos `<tr>` placeholder para 13.

### 3. KPIs no topo
Manter os 5 atuais e mapear para os pedidos:
- Total previsto = `Σ totalGeral` (nova soma, cobre Enf + Apt + Inc − Exc).
- Notas emitidas = `rows.length` (já existe).
- Vencendo hoje = igual.
- Vencidos = igual (mostrado como "Total vencido").
- Com prorrogação = igual (mostrado como "Total prorrogado").

### 4. Painel expandido (`DetalheAnalise`)
Acrescentar duas linhas no grid quando houver exclusões:
- "Exclusões — Qtd" e "Exclusões — Total" (em vermelho se negativo).

### 5. Filtros e ordenação
Sem mudança. O filtro "valor" continua usando `totalGeral`.

### Restrições explícitas
- Não alterar `data_vencimento` nem `data_prorrogacao`.
- Não tocar em `financeiro_movimentacoes`, `anexos_financeiro`, regras de status, RLS ou aba Financeiro.
- Continuar exibindo apenas linhas com status `Nota emitida` ou `Enviada` (mantém comportamento atual).
- Não criar migrações.
