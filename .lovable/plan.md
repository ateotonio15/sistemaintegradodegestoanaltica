## Editor de perguntas do formulário de Avaliação RH

Permitir que **Admin, Executivo (Diretora) e Executivas** editem o "Preview do formulário" — alterar perguntas existentes, adicionar novas e remover.

### Funcionalidades
- Botão **"Editar perguntas"** no card de preview (visível apenas para perfis permitidos).
- Modo de edição inline com:
  - Editar título e descrição de cada pergunta
  - Trocar tipo (Nota 1-5 / Texto livre)
  - Marcar como obrigatória
  - Reordenar (subir/descer)
  - Remover pergunta
  - **+ Adicionar pergunta** (gera id único `q<timestamp>`)
- Editar também título e instruções do formulário
- Botões **Salvar** / **Cancelar** ao final

### Permissões
Frontend: gate por perfil via `useAuth` (roles: `admin`, `executivo`, mais o nome da executiva via `profiles`). Usuários sem permissão veem o preview apenas em leitura (como hoje).

Backend: política RLS de UPDATE em `cs_avaliacao_formularios` restrita a `admin` ou `executivo` (via `has_role`). SELECT continua público.

### Mudança crítica
Hoje o `useEffect` em `AvaliacoesRH.tsx` **sobrescreve as perguntas com o TEMPLATE a cada mount**, o que apagaria qualquer edição. Vou remover essa sincronização: o TEMPLATE só será usado quando não existir nenhum formulário ainda (insert inicial).

### Arquivos afetados
- `src/modules/carteira-samel/pages/AvaliacoesRH.tsx` — remover sync forçado, adicionar botão de editar + dialog/seção de edição, gate de permissão.
- Novo: `src/modules/carteira-samel/components/EditarFormularioRHDialog.tsx` — dialog com editor de perguntas (drag-free, botões ↑↓).
- Migration: política RLS de UPDATE em `cs_avaliacao_formularios` para admin/executivo.

### Pontos a confirmar durante build
- Validar pelo menos 1 pergunta antes de salvar.
- Ao salvar, `setForm` com o retorno do update para refletir imediatamente no preview e no dashboard.