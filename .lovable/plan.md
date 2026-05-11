## Diagnóstico

A coluna **Retroativo** e **Valor Final** existem no frontend (`Reajustes.tsx` linhas 311–344) e estão sendo lidas com `select("*")`. O problema **não está no frontend** nem na query.

A causa raiz está no **banco**: as funções `trg_reajuste_calc_campos`, `trg_criar_alerta_reajuste`, `trg_finalizar_alerta_reajuste` e `guard_reajuste_comum` existem como FUNCTIONS, mas **nenhum TRIGGER está anexado** à tabela `reajustes_anuais` (verificado em `information_schema.triggers` — retorno vazio).

Resultado: ao inserir/atualizar um reajuste, o cálculo de `valor_retroativo_centavos`, `valor_final_centavos` e `meses_retroativos` nunca roda. Confirmação na linha existente:

```
valor_antigo:        28.657
percentual:          6,06%
valor_reajustado:    30.394   (calculado no ReajusteDialog antes do insert)
valor_retroativo:    0        (deveria ser calculado pelo trigger)
valor_final:         0        (deveria ser valor_reajustado + retroativo)
```

Como `temValores` no frontend exige `valor_antigo_centavos > 0`, a célula renderiza `R$ 0,00` para Retroativo/Final em vez de aparecer vazio — mas o valor está incorreto.

## Correção (somente migração SQL)

### 1. Anexar triggers faltantes em `reajustes_anuais`

```sql
DROP TRIGGER IF EXISTS trg_reajuste_calc_campos ON public.reajustes_anuais;
CREATE TRIGGER trg_reajuste_calc_campos
  BEFORE INSERT OR UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_reajuste_calc_campos();

DROP TRIGGER IF EXISTS trg_guard_reajuste_comum ON public.reajustes_anuais;
CREATE TRIGGER trg_guard_reajuste_comum
  BEFORE UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.guard_reajuste_comum();

DROP TRIGGER IF EXISTS trg_criar_alerta_reajuste ON public.reajustes_anuais;
CREATE TRIGGER trg_criar_alerta_reajuste
  AFTER INSERT ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_criar_alerta_reajuste();

DROP TRIGGER IF EXISTS trg_finalizar_alerta_reajuste ON public.reajustes_anuais;
CREATE TRIGGER trg_finalizar_alerta_reajuste
  AFTER UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_finalizar_alerta_reajuste();
```

### 2. Backfill dos registros existentes

```sql
UPDATE public.reajustes_anuais
   SET valor_reajustado_centavos = CASE
         WHEN valor_antigo_centavos IS NOT NULL AND percentual IS NOT NULL AND percentual > 0
         THEN ROUND(valor_antigo_centavos + (valor_antigo_centavos * percentual / 100.0))::bigint
         ELSE valor_reajustado_centavos END,
       valor_retroativo_centavos = COALESCE(
         ((COALESCE(valor_reajustado_centavos,0) - COALESCE(valor_antigo_centavos,0))
          * COALESCE(meses_retroativos, 0))::bigint, 0),
       valor_final_centavos = COALESCE(valor_reajustado_centavos,0)
                            + COALESCE(((COALESCE(valor_reajustado_centavos,0) - COALESCE(valor_antigo_centavos,0))
                                        * COALESCE(meses_retroativos, 0))::bigint, 0);
```

(Disparado via UPDATE direto após criar o trigger; o próprio `BEFORE UPDATE` recalcula tudo.)

## Sem mudanças no frontend

Renderização, query (`select("*")`), tipos e formatação BRL já estão corretos. A coluna aparece com `R$ 0,00` mesmo quando zero (nunca vazia), exatamente como pedido — basta os valores ficarem corretos no banco.

## Não será feito

- Não alterar `Reajustes.tsx`, `ReajusteDialog.tsx`, `reajuste-utils.ts` ou tipos.
- Não remover/renomear colunas.
- Não tocar nas RLS policies.
