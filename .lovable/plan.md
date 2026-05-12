## Objetivo

Trocar o envio direto (RPC) do botão **"Solicitar Reajuste"** no Dashboard por um **modal rápido** com prévia automática, reaproveitando o componente já existente `SolicitarReajusteDialog` usado na aba Reajustes.

## Onde mexer

Apenas em `src/components/reajustes/AlertaReajustesPendentes.tsx` (card amarelo "X contratos precisam de reajuste" no Dashboard do Visualização/Admin).

Nenhuma mudança em backend, RLS ou regras de fluxo — o dialog já chama o mesmo RPC `solicitar_reajuste` e cria o alerta para o Cadastro responsável.

## Mudanças

1. Remover a `solicitarMutation` que chamava `supabase.rpc("solicitar_reajuste")` direto pelo clique do botão.
2. Importar `SolicitarReajusteDialog` de `@/components/reajustes/SolicitarReajusteDialog`.
3. Adicionar estado local `empresaSelecionada` (objeto com `id`, `nome`, `codigo_contrato`, `data_implantacao`) e renderizar o `<SolicitarReajusteDialog open={!!empresaSelecionada} onOpenChange={...} empresa={empresaSelecionada} />`.
4. Botão "Solicitar Reajuste" da tabela passa a apenas setar `empresaSelecionada` (abre o modal). Remover estado `solicitandoId` e o texto "Enviando...".
5. Após o modal fechar com sucesso, ele já invalida as queries de reajustes — adicionar invalidate de `["reajustes-pendentes-list"]` no `onSuccess` do dialog se ainda não estiver presente (verificar; se faltar, adicionar para o card sumir/atualizar imediatamente).

## Comportamento resultante

- Clique em "Solicitar Reajuste" abre o modal moderno (mesmo da aba Reajustes) com:
  - Empresa, Contrato, Implantação e Mês de reajuste pré-preenchidos.
  - Checkbox Enfermaria / Apartamento.
  - Campos dinâmicos de valor atual por modalidade selecionada.
  - Percentual obrigatório + preview automático (Valor Atual, %, Valor Reajustado, Retroativo, Valor Final) por modalidade.
  - Botão "Enviar para Cadastro" valida campos, salva o reajuste, gera alerta para o Cadastro responsável e fecha o modal com toast de sucesso.
- A empresa permanece no card do Dashboard até o Cadastro confirmar/liberar (regra atual preservada).
- Permissões mantidas: visualização/admin abrem; Cadastro confirma na aba Reajustes.

## Não fazer

- Não criar página nova.
- Não alterar tabelas, RPCs ou RLS.
- Não mexer no fluxo de confirmação do Cadastro.
- Não remover a empresa do card antes da liberação.