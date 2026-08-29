# Grupo de Contratos na aba Movimentações

Levar a regra de Grupo Financeiro (hoje só na aba Faturamento) para a aba Movimentações: o contrato principal do grupo concentra datas, anexos e observações, e os demais contratos do grupo passam a refletir essas informações.

## Comportamento

- Cada Grupo Financeiro passa a ter um **contrato principal**, escolhido no cadastro do grupo.
- Na aba Movimentações, ao abrir uma movimentação de um contrato do grupo:
  - Aparece a tag "Grupo: <nome>" com a lista dos contratos vinculados e a indicação de qual é o principal.
  - **Datas** (Envio Empresa, Retorno Empresa, Envio Financeiro) preenchidas no principal são replicadas para as movimentações dos demais contratos do grupo na mesma competência e período.
  - **Observações** registradas no principal aparecem também nos contratos vinculados (leitura compartilhada, mantendo o histórico com autor e data).
  - **Anexos** enviados no principal não são copiados: aparecem nos demais contratos com o selo "Do grupo", como acontece na aba Faturamento. O download funciona normalmente; excluir só é permitido no contrato de origem.
- Nos contratos secundários, os campos de data ficam somente leitura com aviso "Gerenciado pelo contrato principal do grupo" e um atalho para abrir o principal.
- Se o grupo não tiver contrato principal definido, tudo continua funcionando como hoje (sem compartilhamento).

## Detalhes técnicos

**Banco**
- Nova coluna `contrato_principal_empresa_id` (uuid, nullable) em `grupos_financeiros`, referenciando `empresas`.
- Sem alteração em `anexos_movimentacao` (compartilhamento é feito na leitura, não por cópia).
- RLS: os contratos do grupo já são visíveis pelas policies atuais de `anexos_movimentacao`/`movimentacoes`; será validado se a leitura cruzada por grupo passa nas policies existentes e, se necessário, ajustada uma policy de leitura por grupo.

**Frontend**
- `src/components/empresas/GrupoFinanceiroSection.tsx`: seletor de contrato principal entre os contratos ativos do grupo.
- `src/hooks/useGrupoFinanceiro.ts`: expor `contrato_principal_empresa_id` e um mapa `empresa_id -> { grupo_id, nome_grupo, principal_empresa_id }`.
- `src/pages/Movimentacoes.tsx`:
  - usar o mapa de grupo para identificar principal/secundário;
  - no `upsert`, quando a movimentação for do contrato principal, replicar datas e observação para as movimentações irmãs (mesma `mes_referencia` + `periodo`) dos contratos do grupo;
  - bloquear edição de datas nos secundários e exibir badge de grupo na linha e no diálogo.
- `src/components/movimentacoes/AnexosMovimentacao.tsx` e `AnexosMovimentacaoDialog.tsx`: buscar também os anexos das movimentações irmãs do grupo (mesma competência/período), marcá-los com selo "Do grupo" e desabilitar exclusão fora do contrato de origem — reaproveitando a lógica de `expandirAnexosPorGrupo` de `src/lib/financeiro-utils.ts`.
