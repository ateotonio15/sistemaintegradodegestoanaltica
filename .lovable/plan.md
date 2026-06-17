## Objetivo

A tela **Score de Risco** (`/carteira-samel/score`) hoje lista automaticamente todas as empresas ativas EMPRESARIAL. Você quer que ela comece **vazia** e que cada usuário/administrador **inclua manualmente** as empresas que quiser acompanhar.

## O que será feito

### 1. Nova tabela `cs_score_empresas`
Guarda apenas as empresas que foram explicitamente incluídas no Score de Risco.

Campos: `empresa_id` (referência à empresa), `incluida_por`, `incluida_em`.

Acesso: leitura para todos autenticados; inclusão/remoção apenas para perfis admin, diretora e executivo (mesma régua das outras telas da carteira).

### 2. Página Score de Risco
- Não busca mais "todas as empresas EMPRESARIAL".
- Lista somente as empresas presentes em `cs_score_empresas`.
- Mantém os mesmos cálculos (score, semáforo, ações) sobre essa lista.
- Estado vazio: mensagem "Nenhuma empresa no acompanhamento de risco" + botão **Adicionar empresa**.
- Novo botão no topo: **Adicionar empresa** → dialog com busca para escolher entre as empresas ativas da base e incluir no Score.
- Botão de remover (lixeira) em cada card/linha para tirar a empresa do Score (não exclui a empresa do sistema, só do acompanhamento).

### 3. Compatibilidade com outras abas da Carteira
As demais páginas da Carteira Samel (Visão Geral, Sinistralidade, Avaliações RH etc.) continuam usando todas as empresas como hoje — a restrição vale **só** para a aba Score de Risco.

## Detalhes técnicos

- Migração cria `public.cs_score_empresas (empresa_id uuid PK, incluida_por uuid, incluida_em timestamptz)` com FK para `empresas(id) on delete cascade`, GRANTs para `authenticated` e `service_role`, RLS habilitado e políticas usando `has_role`.
- Novo hook `useScoreEmpresas` para listar/incluir/remover.
- `ScoreRisco.tsx` deixa de consumir `useEmpresasCarteira().ativas` e passa a usar a lista curada + `getById` para resolver os dados de cada empresa.
- Novo componente `AdicionarEmpresaScoreDialog` reutiliza o `Command`/`Combobox` do shadcn para busca por nome ou contrato.

## Confirmação

Posso seguir com essa abordagem (esvazia e deixa adicionar manualmente, com persistência no banco para todos verem a mesma lista)?  
Ou prefere que seja **só na sua tela** (sem salvar no banco, lista local por usuário)?
