## Objetivo

Completar o fluxo Cadastro → Financeiro:

```text
Cadastro clica botão "Alertar vencimento"
        │
        ▼
Empresa aparece no Dashboard Financeiro
        │  Card: Faturamentos Enviado
        │  Mostra: Empresa · Contrato · Data envio · Usuário · Anexos · Status
        │
        ▼
Financeiro preenche Data de Vencimento
        │
        ▼
Empresa sai automaticamente da lista
```

## Estado atual

- O Dashboard Financeiro hoje tem **dois cards separados**: "Alertas de Vencimento" e "Faturamentos Enviado" (este último mostra alertas de envio de nota — fluxo diferente).
- O alerta de vencimento é gravado na tabela `alertas_financeiro` com `tipo='vencimento'` e `status='Pendente'`, mas o card que o exibe é minimalista: só mostra nome da empresa, quem enviou e a data.
- O trigger `handle_finalizar_alerta_vencimento` já marca o alerta como Finalizado quando o Financeiro preenche `data_vencimento` — então a remoção da lista já funciona.

## O que muda

### 1. Renomear e reposicionar
- O card **"Alertas de Vencimento"** passa a se chamar **"Faturamentos Enviado"** no Dashboard Financeiro (espelha o nome do card do Cadastro, fechando o ciclo visual).
- O card antigo "Faturamentos Enviado" do Financeiro (alertas de nota) é renomeado para **"Notas a Enviar"** para evitar confusão. Continua funcionando igual, só muda o nome.

### 2. Linhas do novo "Faturamentos Enviado" (Financeiro)

Cada linha exibirá:

| Campo          | Origem                                                              |
|----------------|---------------------------------------------------------------------|
| Empresa        | `alertas_financeiro.empresa_nome`                                   |
| Contrato       | `empresas.codigo_contrato` (lookup pelo `empresa_id`)               |
| Data envio     | `alertas_financeiro.data_envio` (formato DD/MM/AAAA)                |
| Usuário        | `alertas_financeiro.enviado_por_nome`                               |
| Anexos         | Soma: `anexos_movimentacao` (do `movimentacao_id`) + `anexos_financeiro` (do `financeiro_movimentacao_id` correspondente) |
| Status         | Badge amarelo "Pendente"                                            |

Layout da linha:
```text
┌────────────────────────────────────────────────────────────────────────┐
│ NOME DA EMPRESA                                       [📎 3] [Pendente]│
│ Contrato: 12345 · Enviado por João · 27/04/2026                        │
└────────────────────────────────────────────────────────────────────────┘
```

Botão "Resolver no Financeiro" no cabeçalho continua levando para `/financeiro` (onde o Vencimento é preenchido).

### 3. Saída automática da lista
Sem mudanças no backend — o trigger `handle_finalizar_alerta_vencimento` já roda em `financeiro_movimentacoes` e marca o alerta como `Finalizado` quando `data_vencimento` é preenchido. O card consulta apenas `status='Pendente'` e `tipo='vencimento'`, então a empresa some imediatamente. O realtime já está ativo na tabela.

## Detalhes técnicos

- **Arquivo principal alterado**: `src/components/dashboard/AlertasVencimentoFinanceiro.tsx`
  - Renomear título visual para "Faturamentos Enviado"
  - Adicionar queries para: `empresas` (codigo_contrato por id), `movimentacoes` (mapear alertas → financeiro_movimentacao_id correspondente via empresa_id+mes+periodo), `anexos_movimentacao` agrupado por movimentacao_id, `anexos_financeiro` agrupado por financeiro_movimentacao_id
  - Reescrever a renderização da linha com os 6 campos
  - Realtime: adicionar canais para `anexos_movimentacao` e `anexos_financeiro`
- **Arquivo auxiliar alterado**: `src/components/dashboard/FaturamentosEnviadoFinanceiro.tsx`
  - Trocar título visual de "Faturamentos Enviado" para "Notas a Enviar" (evita dois cards com o mesmo nome)
- **Sem mudanças no banco** — schema, trigger e RLS já cobrem o fluxo.
- **Sem mudanças** no `FaturamentosEnviadosCard.tsx` (Cadastro), que já tem o botão "Alertar vencimento" funcional.

## Resultado esperado

Quando o Cadastro clica "Alertar vencimento":
1. A empresa aparece imediatamente no card **Faturamentos Enviado** do Dashboard Financeiro.
2. O Financeiro vê todos os dados que precisa (Empresa, Contrato, Data envio, Usuário, Anexos, Status Pendente) sem precisar abrir nada.
3. Ao clicar "Resolver no Financeiro" e preencher a Data de Vencimento, a empresa some da lista automaticamente.
