# Excluir contratos em implantação (Admin e Vendas)

Permitir que perfis **Admin** e **Vendas** excluam contratos da tela de Implantação.

## 1. Backend (migration)

- Adicionar política RLS em `implantacoes_contratos`:
  - `Vendas delete implantacoes` → DELETE permitido quando `has_role(auth.uid(), 'vendas')` (qualquer contrato, não só os próprios).
- Garantir limpeza em cascata das tabelas dependentes:
  - `implantacao_anexos` (incluindo storage — feito no client antes do delete).
  - `implantacao_alertas`.
  - `implantacao_logs`.
- Criar RPC `excluir_implantacao(p_id uuid)` `SECURITY DEFINER`:
  - Valida que o caller é `admin` ou `vendas` via `has_role`.
  - Apaga registros filhos (alertas, logs, anexos) e o contrato.
  - Retorna lista de `storage_path` dos anexos para o client remover do bucket.
- Admin já tem ALL; Vendas ganha DELETE amplo via política + RPC.

## 2. Frontend

- `src/pages/Implantacao.tsx`:
  - Importar `useAuth` para flag `isVendas` (já existe `isAdmin`).
  - Em cada card da lista, adicionar botão lixeira (canto superior direito) visível só para `isAdmin || isVendas`.
  - Click abre `AlertDialog` (shadcn) de confirmação com nome da empresa.
  - Ao confirmar: chamar RPC `excluir_implantacao`, remover anexos do storage (paths retornados), invalidar `["implantacoes"]`, `["implantacoes-andamento"]`, `["implantacao-alertas-count"]` e toast de sucesso.
- `src/components/dashboard/ImplantacoesAndamentoCard.tsx`:
  - Mesmo botão lixeira no card, com `stopPropagation` para não abrir navegação.

## 3. Não fazer

- Não permitir exclusão para outros perfis (Comum/Diretora/Visualização/Financeiro).
- Não apagar dados de `empresas` mesmo quando o contrato referencia uma empresa criada.
- Sem soft-delete — exclusão definitiva (mais simples e é o pedido do usuário).
