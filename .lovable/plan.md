# Restringir ícone "DDA" ao status "Nota emitida"

## Objetivo
O ícone/badge "DDA" ao lado do nome da empresa na aba **Financeiro** só deve aparecer (e ser editável) após a movimentação atingir o status **"Nota emitida"** (ou superior — "Enviada", que já pressupõe nota emitida). Antes disso fica oculto. Validação também no backend.

## Como o status é calculado hoje
Em `src/lib/financeiro-utils.ts`, `calcularStatusFinanceiro()` retorna `"Nota emitida"` quando existe **anexo PDF**, e `"Enviada"` quando `data_envio_nota` está preenchida. Ambos significam que a nota já foi emitida — então o DDA fica liberado nesses dois casos. Para os demais (`Pendente`, `Aguardando nota`, `Faturado`, `Fora do prazo`) o ícone fica oculto.

## Mudanças

### 1. `src/components/financeiro/FinanceiroTable.tsx`
- Envolver o `<Badge>` "DDA" / "DDA OK" em uma condição: renderizar somente se `row.status === "Nota emitida" || row.status === "Enviada"`.
- Nenhuma outra mudança visual (mantém cores verde/amarelo já existentes).

### 2. `src/components/financeiro/EditarMovimentacaoDialog.tsx`
- Calcular um booleano `notaEmitida` a partir do mesmo critério (anexos com PDF **ou** `data_envio_nota` preenchida) — já temos esses dados no diálogo.
- Desabilitar o `Switch` "Boleto DDA" quando `!notaEmitida` (além da regra de permissão já existente `canEditFinanceiro`).
- Mostrar mensagem auxiliar abaixo do switch: *"Disponível após emissão da nota fiscal."* quando bloqueado por status.
- Se a movimentação ainda não tem nota emitida mas `boleto_dda` já estava `true` (caso raro de dados legados), exibir mesmo assim como leitura, mas não permitir alterar.

### 3. Backend — trigger de validação (migration)
Criar trigger `BEFORE UPDATE` em `public.financeiro_movimentacoes` que bloqueia mudar `boleto_dda` de `false → true` quando a movimentação ainda **não tem nota emitida**. Critério (espelha o frontend):

```sql
nota_emitida := (NEW.data_envio_nota IS NOT NULL)
  OR EXISTS (
    SELECT 1
    FROM public.movimentacao_anexos ma
    WHERE ma.empresa_id = NEW.empresa_id
      AND ma.mes_referencia = NEW.mes_referencia
      AND ma.periodo = NEW.periodo
      AND (lower(coalesce(ma.mime_type,'')) LIKE '%pdf%'
           OR lower(coalesce(ma.nome_arquivo,'')) LIKE '%.pdf')
  );
```
Se `NEW.boleto_dda = true` e `OLD.boleto_dda IS DISTINCT FROM true` e `NOT nota_emitida` → `RAISE EXCEPTION 'Boleto DDA só pode ser confirmado após emissão da nota fiscal'`.

Também limpar `boleto_confirmado_por` / `boleto_confirmado_em` quando `boleto_dda` voltar para `false` (consistência — já é feito no frontend, mas garantir no banco).

> Observação: nome real da tabela de anexos será confirmado na migração (provavelmente `movimentacao_anexos` conforme padrão do projeto); ajusto no SQL final se necessário.

## Compatibilidade
- Movimentações antigas com nota já emitida → ícone aparece automaticamente (regra é derivada do status atual, não há flag a preencher).
- Movimentações antigas sem nota → ícone oculto, conforme pedido.
- Permissões existentes (`canEditFinanceiro`) continuam valendo; a nova regra é adicional.

## Arquivos
- `src/components/financeiro/FinanceiroTable.tsx` (condição de render)
- `src/components/financeiro/EditarMovimentacaoDialog.tsx` (gate do Switch + mensagem)
- Nova migration: trigger de validação em `financeiro_movimentacoes`
