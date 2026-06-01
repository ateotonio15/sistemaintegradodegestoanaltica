Plano para corrigir os novos contratos que não aparecem:

1. **Ajustar a geração do Dashboard**
   - Trocar a criação de movimentações operacionais para usar deduplicação real por `empresa_id + mês + período`.
   - Substituir inserção simples por criação tolerante a duplicados, usando a chave única existente.
   - Evitar que um contrato novo deixe de ser criado porque outro registro duplicado interrompeu o lote.

2. **Ajustar a geração do Financeiro**
   - Aplicar a mesma proteção contra duplicidade em `financeiro_movimentacoes`.
   - Garantir que contratos ativos, faturáveis e já vigentes no mês escolhido sejam provisionados corretamente.
   - Manter a regra atual de vigência: contratos implantados em mês futuro não aparecem antes da implantação; contratos do mês entram no período correspondente quando válido.

3. **Melhorar a atualização da tela**
   - Invalidar as consultas corretas depois de gerar movimentações para a aba Financeiro recarregar imediatamente.
   - Preservar filtros, período e busca existentes.

4. **Validar com os contratos recentes**
   - Conferir contratos como `2527` e os demais recém-cadastrados.
   - Verificar se aparecem em `Jun/2026` após clicar em **Gerar movimentações**.

Detalhe técnico:
- O problema provável é que a geração ainda usa `.insert()` simples em alguns pontos. Quando existe duplicidade ou corrida de dados, o lote falha e os contratos novos não chegam a ser criados. A correção será usar deduplicação em memória + `upsert/ignoreDuplicates` no conflito `empresa_id, mes_referencia, periodo`.