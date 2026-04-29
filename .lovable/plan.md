## Objetivo

Aplicar no card **"Faturamentos Não Enviados"** do Dashboard (Cadastro/Admin) o mesmo filtro de empresas ativas que já é usado na aba Financeiro, ocultando registros de empresas que foram desativadas, suspensas ou que possuem data de rescisão.

## Regra de "empresa ativa"

Idêntica à aplicada hoje em `src/pages/Financeiro.tsx`:

- `status_empresa = "Ativa"` (ou nulo, tratado como "Ativa")
- `data_rescisao` ausente/nula
- `contrato_suspenso = false`

Se qualquer uma dessas condições falhar, os faturamentos pendentes daquela empresa **não aparecem** no card.

## Mudança

Arquivo: `src/components/dashboard/FaturamentosEnviadosCard.tsx`

1. Na query `faturamentos-empresa-ids-vinculadas`, ao invés de retornar apenas `id`, buscar também `status_empresa, data_rescisao, contrato_suspenso` e retornar somente os IDs das empresas ativas.
   - Aplica tanto para Admin (que hoje pega todas) quanto para Cadastro/Comum (que combina `responsavel_user_id` + `empresa_usuarios`): após montar o conjunto de IDs vinculados, filtrar pelos ativos.
2. Como `pendentes` já usa `.in("empresa_id", empresaIdsVinculadas)`, basta o passo 1 para o card refletir a regra automaticamente.
3. Nenhuma mudança de UI, contagem do badge e lista são recalculadas a partir do mesmo `linhas`.

## Fora de escopo

- Não alterar a aba Financeiro (já filtra).
- Não alterar `FaturamentosEnviadoFinanceiro` (dashboard do Financeiro) — caso queira o mesmo comportamento lá, podemos tratar em pedido separado.
- Sem mudanças de banco/RLS.