# Etapa 46 — Novo perfil "Administradoras"

Criação de um perfil novo, com dashboard exclusivo, regras específicas de movimentação e cadastro inteligente de empresas que se adapta ao tipo de contrato (Empresarial x Administradora).

## 1. Banco de dados

Migração nova:

- Adicionar valor `'administradoras'` ao enum `app_role`.
- Tabela `empresas`: novo campo `tipo_contrato text not null default 'EMPRESARIAL'` com check em (`'EMPRESARIAL'`, `'ADMINISTRADORA'`).
- Atualizar trigger `guard_empresas_executivo` para incluir o novo campo na lista de campos protegidos.
- RLS:
  - `empresas`, `movimentacoes`, `anexos_movimentacao`, `empresa_usuarios`, `implantacoes_contratos`, `implantacao_anexos`, `implantacao_alertas`, `profiles`: adicionar policies de leitura para o role `administradoras` (mesmos moldes das policies de `executivo`/`visualizacao`).
  - Sem nenhuma policy para `administradoras` em `financeiro_*`, `reajustes*`, `user_roles`, garantindo bloqueio.
- Função `has_role` já cobre o novo enum automaticamente.

## 2. Autenticação e roteamento

- `src/hooks/useAuth.tsx`: adicionar `isAdministradoras` ao tipo e ao contexto.
- `src/App.tsx`:
  - `HomeRoute`: se `isAdministradoras`, renderizar novo `DashboardAdministradoras`.
  - `RoleGate` para `/financeiro`, `/arquivos`, `/reajustes`, `/usuarios`, `/executivas`, `/vidas-samel`: bloquear `administradoras`.
  - Rotas permitidas: `/`, `/empresas`, `/movimentacoes`, `/implantacao`.
- `src/components/AppLayout.tsx`: filtro de `navItems` — quando role = `administradoras`, mostrar apenas Dashboard, Empresas, Movimentações, Implantação.
- `src/pages/Usuarios.tsx`: adicionar opção "Administradoras" no select de perfil (somente Admin enxerga).

## 3. Dashboard exclusivo `DashboardAdministradoras`

Novo arquivo `src/pages/DashboardAdministradoras.tsx` no estilo dark-green/Linear já usado.

KPIs (cards):

- Total de Administradoras (empresas com `tipo_contrato='ADMINISTRADORA'` e `status_empresa='Ativa'`).
- Vidas Ativas (soma de `vidas`).
- Próximo Fechamento (próxima `data_corte` 1/5/10/20).
- Contratos Pendentes (sem `data_implantacao` ou implantação em andamento).
- Movimentações do Mês (count em `movimentacoes` no mês atual).

Seções:

- Lista de contratos ativos.
- Movimentações pendentes do período atual.
- Próximos fechamentos agrupados por data de corte.
- Contratos implantados x aguardando.

Filtros: período de corte, status, empresa, situação de implantação, situação de movimentação.

## 4. Cadastro de empresas inteligente (`src/pages/Empresas.tsx`)

- Novo campo obrigatório no formulário: **Tipo de Contrato** (`Empresarial` | `Administradora`), default `Empresarial`.
- Quando `Administradora`:
  - **Ocultar** com transição suave (`animate-fade-in` + `transition-all`):
    Executiva Responsável, Tipo de Movimentação (Fechada/Diária), E-mail, Telefone, Contato, Prazo, Grupo de Contrato.
  - Forçar `tipo_movimentacao = 'Diária'` internamente.
  - Mostrar somente o campo **Data Corte** com opções fixas `1`, `5`, `10`, `20` (Select, não Input).
  - Não enviar/validar os campos ocultos; salvar `null` para eles.
- Quando `Empresarial`: comportamento atual 100% preservado.
- Layout: usar grid que recolapsa automaticamente para não deixar buracos.
- Detalhe da empresa: esconder linhas dos campos não aplicáveis quando `tipo_contrato='ADMINISTRADORA'`.

## 5. Movimentações

- `src/pages/Movimentacoes.tsx`: quando empresa é Administradora, períodos disponíveis = `1`, `5`, `10`, `20` (apenas). Continua usando alertas, fechamento e validações existentes.
- Cálculo de período/cut-off reutiliza utilitários atuais; só muda o conjunto de opções permitidas.

## 6. Permissões resumidas do novo perfil

| Acesso | Administradoras |
| --- | --- |
| Dashboard exclusivo | sim |
| Empresas (leitura + suas) | sim |
| Movimentações | sim |
| Implantação | sim |
| Financeiro | não |
| Reajuste | não |
| Arquivos | não |
| Usuários | não |
| Executivas | não |

## 7. Memória

Atualizar `mem://index.md` Core: incluir perfil "Administradoras (dashboard próprio, períodos 1/5/10/20)" e criar `mem://features/administradoras` com regras do tipo de contrato.

## 8. Detalhes técnicos

- Animações: `transition-all duration-300` + render condicional para evitar validação de campos ocultos (usar `react-hook-form`? — o projeto usa estado manual em `Empresas.tsx`, mantém o mesmo padrão).
- Tipos do Supabase serão regenerados após a migração; nenhum patch manual em `types.ts`.
- Não tocar fluxo Empresarial existente.
- Sem `window.location.reload`, sem refetch automático extra (segue padrão SPA já vigente).

## Ordem de execução

1. Migração SQL (enum + coluna + RLS + trigger).
2. `useAuth`, `App.tsx`, `AppLayout` (roteamento e menu).
3. `Empresas.tsx` (campo Tipo de Contrato + ocultação inteligente).
4. `Movimentacoes.tsx` (períodos 1/5/10/20 para Administradora).
5. `DashboardAdministradoras.tsx` + integração no `HomeRoute`.
6. `Usuarios.tsx` (opção de perfil no select).
7. Atualizar memória.
