# Diagnóstico de lentidão e plano de otimização

## O que a análise encontrou

Medi as consultas que mais pesam no servidor desde o último reinício das estatísticas. A lentidão vem do banco ficar ocupado com consultas repetidas o tempo todo. Não parece falha nem queda.

| # | Consulta | Vezes | Média | Tempo total |
|---|---|---|---|---|
| 1 | Atendimentos de um plantão | 1,2 milhão | 52 ms | ~17 h de servidor |
| 2 | Lista de plantões da empresa com contagem | 34 mil | 292 ms (até 5,7 s) | ~2,8 h |
| 3 | Faturamento por competência (linhas completas) | 171 mil | 39 ms (até 1,4 s) | ~1,8 h |
| 4 | Movimentações por mês e empresas | 19 mil | 98 ms (até 3,8 s) | ~30 min |

O que isso quer dizer:
- **Plantões são o maior gargalo.** A tela de atendimentos de um plantão é buscada mais de 1 milhão de vezes. Cada alteração em qualquer atendimento avisa todas as telas abertas, e cada uma refaz a busca de todos os plantões que tem guardados. As regras de acesso dessa tabela também fazem várias verificações de perfil em cada linha.
- **O Painel TV fica consultando sem parar.** Ele busca a meta a cada 5 segundos e o faturamento a cada 15, em toda TV e em todo navegador aberto. Também recebe avisos em tempo real das mesmas tabelas.
- **Faturamento e Movimentações** trazem todas as colunas de todas as linhas da competência, a cada troca de aba e a cada aviso em tempo real. Isso pesa justo na hora de anexar, porque cada anexo dispara uma nova busca completa em todas as telas abertas.
- Como o banco já está ocupado, o envio de anexos e a troca de abas esperam na fila.

## O que vamos fazer

1. **Plantões:** depois de uma alteração, atualizar só o plantão afetado, e não todos. Juntar as contagens de atendimentos numa única consulta, em vez de uma por linha. Deixar mais simples as regras de acesso que repetem a mesma verificação de perfil.
2. **Painel TV:** buscar a meta a cada 60 segundos e o faturamento a cada 60 segundos, e contar com os avisos em tempo real para o que é imediato. Pausar as buscas quando a aba do navegador não estiver visível.
3. **Avisos em tempo real (Faturamento, Movimentações, Empresas, Reajustes):** agrupar avisos em sequência numa única atualização por alguns segundos, para que 10 anexos seguidos gerem 1 atualização e não 10.
4. **Consultas mais leves:** buscar só as colunas que cada tela usa e guardar o resultado por alguns segundos ao voltar para uma aba já visitada, em vez de recarregar tudo.
5. **Anexos:** depois do envio, atualizar só a linha da empresa afetada, e não a lista inteira.
6. **Índices:** criar índices combinados para as buscas mais frequentes (faturamento por competência e empresa, movimentações por mês e empresa, plantões por data).
7. **Verificar o tamanho do servidor:** se, depois dessas mudanças, o banco continuar no limite em horário de pico, recomendo aumentar a capacidade do servidor. Isso só faz sentido depois de reduzir o desperdício.

## Como vamos medir

Antes e depois das mudanças, vamos comparar quantas vezes cada consulta roda e quanto tempo leva em média, e cronometrar o envio de um anexo e a troca entre Faturamento, Movimentações e Plantões.

## Detalhes técnicos

- `usePlantoesRealtime` (src/hooks/usePlantoes.ts): passar a invalidar `QK.atendimentos(payload.new.plantao_id)` em vez do prefixo geral, com debounce de 2 s.
- A busca da lista de plantões com `plantoes_atendimentos(count)` deve virar uma RPC SECURITY DEFINER que agrega as contagens com `GROUP BY`.
- RLS de `plantoes_atendimentos`: juntar as 4 políticas SELECT do executivo_externo e as de perfil numa política só, usando `has_any_role`.
- PainelTvFinanceiro: trocar `refetchInterval` de 5000 e de 15000 para 60000 e usar `refetchIntervalInBackground: false`.
- useFinanceiroRealtime e o canal de Movimentações/Empresas/Reajustes: debounce de 1,5 a 3 s nas invalidações. Usar `staleTime` de 30 s como padrão no QueryClient e manter as exceções que já usam `staleTime: 0`.
- `select("*")` em financeiro_movimentacoes: trocar pelas colunas que a tela usa.
- Novos índices: `financeiro_movimentacoes(mes_referencia, empresa_id)`, `movimentacoes(mes_referencia, empresa_id)` e `plantoes(data)`.
