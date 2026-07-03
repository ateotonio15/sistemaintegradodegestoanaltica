## Plano — Aba "Calendário de Plantões" (novo módulo de agenda)

### Contexto
Hoje `/plantoes/calendario` só reaproveita a lista de empresas de plantão e mostra uma grade vazia. A especificação pede um módulo executivo próprio, com CRUD, filtros, feriados, cancelamento com motivo e exportação. Vou construir isso como um módulo novo baseado em uma nova tabela `agendamentos_plantao`, sem tocar em `plantoes` / `plantoes_empresas` (esses continuam sendo do módulo "Plantões nas empresas", que já foi desvinculado do calendário).

### 1. Banco (migration)
Nova tabela `public.agendamentos_plantao`:
- `id uuid pk`, `empresa_id uuid` (FK empresas), `empresa_nome text` (snapshot)
- `data date` (obrigatório), `hora_inicio time`, `hora_fim time`
- `executiva text` (nome_completo), `status enum` (`a_confirmar|confirmado|concluido|cancelado`)
- `observacao text`, `motivo_cancelamento text`
- `criado_por text`, `editado_por text`, `created_at`, `updated_at`
- GRANTs para `authenticated` e `service_role`; RLS:
  - SELECT: todos autenticados
  - INSERT/UPDATE/DELETE: perfis `admin`, `interno`, `coordenacao`
  - `externo`: SELECT apenas onde `executiva = seu nome` (carteira)
  - `enfermeira` / `qualidade`: sem escrita
- Trigger `updated_at` + realtime publication.

### 2. Hooks
- `useAgendamentosPlantao(range)` — lista por intervalo + realtime.
- `useAgendamentoMutations` — create (multi-datas → N inserts), update, delete.
- `useExecutivas()` — reaproveitar se existir; caso não, criar leitura de `profiles` (`interno|externo|coordenacao`, ativos).
- `useFeriados` já existe e será usado tanto para exibição quanto para bloqueio de datas.

### 3. Nova página `PlantoesCalendario.tsx` (reescrita)
Layout Seg–Sex (5 colunas):
- Header: título + subtítulo + botões "Exportar Excel" / "+ Novo evento" (gated por permissão).
- Filtros: `EmpresaAutocomplete` (Todas), Executiva (Todas + lista), Status (Todos + 4), "Limpar filtros".
- Legenda de feriados (Nacional/Estadual/Municipal).
- Navegador de mês (◀ Hoje ▶) em pt-BR.
- Grade só útil (Seg–Sex): dias com badge de feriado, chips com hora · empresa · executiva coloridos por status:
  - `a_confirmar` amarelo, `confirmado` verde-100, `concluido` emerald-700 branco.
  - `cancelado` **não** aparece na grade (mas fica na base).
- Clique em célula vazia → modal Novo com data pré-preenchida; clique em chip → modal Edição.

### 4. Modal Novo/Editar
- Campos na ordem: Empresa (`EmpresaAutocomplete`), Data (Calendar `mode="multiple"`, `weekStartsOn=1`, desabilita fim de semana + feriados; travado em 1 data ao editar), Hora início/fim, Observação, Status, Executiva responsável (só `mayara.meireles` pode alterar; demais veem próprio nome desabilitado), Motivo do cancelamento (visível/obrigatório apenas se status = `cancelado`).
- Validações: empresa obrigatória, ≥1 data, hora_fim > hora_inicio, data não pode ser feriado (toast com nome do feriado) nem fim de semana.
- Auditoria automática: `criado_por` no insert; `editado_por`+`updated_at` no update.
- Rodapé Edição: botão Excluir com `AlertDialog`.

### 5. Exportação Excel
Arquivo `calendario-plantoes-YYYY-MM.xlsx` com colunas: Data · Empresa · Horário início · Horário fim · Executiva · Status · Motivo cancelamento · Observação · Criado por · Última edição (`editado_por` em `dd/MM/yyyy HH:mm`). Inclui cancelados.

### 6. Permissões (frontend + RLS)
| Perfil | Ação |
|---|---|
| admin / interno / coordenacao | CRUD completo |
| enfermeira | leitura total |
| externo | leitura só da sua carteira |
| qualidade | sem acesso à rota |

Campo Executiva desbloqueado apenas para `mayara.meireles` (regra temporária, comentada no código).

### 7. Realtime + UX
- Invalida query após create/update/delete; realtime channel em `agendamentos_plantao`.
- `toast` em sucesso/erro/validação.
- Loading discreto; `pointer-events-auto` no Calendar dentro do Popover.

### Ordem de execução
1. Migration `agendamentos_plantao` + RLS + realtime → aguardar aprovação do usuário.
2. Após aprovação: criar hooks, modal e reescrever a página.
3. Verificar build e testar rota `/plantoes/calendario`.

### Perguntas antes de começar
1. **Empresas**: uso a lista completa de `empresas` (todas ativas) ou continuo restringindo às empresas ligadas a plantão (`plantoes_empresas`)? A spec fala "iaempresasativa" (ilegível) — assumo `empresas` ativas gerais, confirme.
2. **Perfil `externo`**: tenho como identificar a "carteira" via `executiva = nome_completo` do próprio usuário logado, correto? Ou existe outro vínculo?
3. **Substituição total**: posso descartar o código atual da página (que ainda referencia `usePlantaoEmpresas` só para popular filtro)? A nova página não terá mais nada do módulo antigo.
