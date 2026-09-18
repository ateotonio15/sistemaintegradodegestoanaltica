# Finalizar o módulo Dependentes UEA

Três entregas, sem mexer em nenhum outro módulo.

## 1. Próximas mudanças de faixa

Nova área na tela Dependentes UEA, acima da lista de titulares, mostrando cada dependente ativo que vai mudar de valor.

Cada cartão traz: nome do dependente, titular, data de nascimento, data da mudança, valor atual, novo valor, diferença (+R$), margem atual do titular, margem após o reajuste e o status:
- "Possui margem" quando a margem após o reajuste continua positiva;
- "Ficará sem margem" (destaque vermelho) quando o novo valor ultrapassa a margem.

Filtros da área: próximos 30 dias, 60 dias, 90 dias, "Ficará sem margem", "Com margem suficiente".

Titulares com dependente que vai ficar sem margem continuam destacados na lista principal.

## 2. Histórico por titular

Passa a existir histórico completo do titular, somando o que já é registrado nos dependentes e os novos eventos:
- alteração da margem (de / para);
- inclusão de dependente;
- mudança de valor e mudança de faixa;
- desligamento por falta de margem;
- reativação;
- alteração manual (edição de dados do dependente).

Cada linha mostra data e hora, o que aconteceu, valores de/para, dependente envolvido e o responsável. Registros nunca são apagados nem editados — apenas acrescentados. A aba Histórico do titular passa a exibir essa linha do tempo unificada.

## 3. Permissões em "Usuários"

Na edição e na criação de usuário, duas caixas novas (permissões individuais, sem criar perfil novo):
- Visualizar Dependentes UEA — consulta titulares, dependentes, valores, margem e histórico;
- Editar Dependentes UEA — alterar margem, status, desligar, reativar, incluir/editar dependentes e faixas.

Regras:
- sem "Visualizar": a aba não aparece no menu e o acesso direto pelo endereço é bloqueado (redireciona);
- só "Visualizar": tudo em modo leitura, botões de ação ocultos;
- "Editar" implica poder ver;
- administradores continuam com acesso total, como já ocorre hoje em todo o sistema;
- nenhuma permissão existente é alterada.

## Detalhes técnicos

Banco (migração nova, nada removido):
- `public.uea_permissoes` (user_id PK ref auth.users, pode_visualizar bool, pode_editar bool, timestamps) com GRANTs, RLS: o próprio usuário lê a sua linha; admin lê/escreve tudo.
- `public.uea_titular_historico` (id, titular_id FK, dependente_id nullable, tipo, descricao, valor_anterior, valor_novo, margem_momento, created_by, created_at) — somente INSERT e SELECT nas policies (nunca UPDATE/DELETE), garantindo que registros não sejam apagados.
- Função `public.has_uea_access(_user_id uuid, _nivel text)` SECURITY DEFINER (admin OU permissão correspondente).
- Policies de `uea_titulares`, `uea_dependentes`, `uea_faixas`, `uea_dependente_historico` e das novas tabelas passam a usar `has_uea_access(auth.uid(),'ver')` para SELECT e `has_uea_access(auth.uid(),'editar')` para escrita, preservando o acesso admin atual.

Frontend:
- `src/hooks/useUeaPermissoes.ts`: permissão do usuário logado (`canVerUea`, `canEditarUea`) e leitura/gravação por usuário na tela de Usuários.
- `AppLayout.tsx`: item "Dependentes UEA" passa de `adminOnly` para condicionado a `canVerUea`.
- `App.tsx`: rota `/dependentes-uea` protegida por `canVerUea`.
- `src/lib/dependentes-uea.ts`: cálculo de `proximas mudancas` (lista achatada com diferença, margem após reajuste e status) e filtros 30/60/90.
- `src/pages/DependentesUEA.tsx`: seção "Próximas mudanças de faixa" + filtros; ações escondidas quando sem permissão de editar.
- `useDependentesUea.ts`: registro no histórico do titular em margem, inclusão/edição, desligamento, reativação e aplicação de faixa; hook de histórico unificado.
- `src/pages/Usuarios.tsx`: checkboxes das duas permissões nos diálogos de criar e editar usuário.
