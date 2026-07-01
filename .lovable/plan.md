## Calendário de Ações Preventivas

Nova aba dentro do módulo Saúde nas Empresas para agendar visualmente 3 tipos de ações preventivas (Sinais Vitais, Coleta de Preventivo, Coleta de PSA) num calendário mensal seg–sex.

### Navegação
- Rota nova: `/saude-empresas/preventivas` (link no menu lateral do módulo Saúde).
- Nível 1 — sem `?tipo=`: 3 cards clicáveis (grid md:3) com ícones em gradiente.
- Nível 2 — com `?tipo=<slug>`: cabeçalho + banner (só PSA) + filtros + calendário + modal.

### Banco de dados
Nova tabela `acoes_preventivas` (via migration):
- `tipo` enum: `sinais_vitais | preventivo | psa`
- `empresa`, `endereco`, `data`, `horario_inicio`, `horario_fim`
- `responsavel`, `executiva`, `observacao`
- `status` enum: `a_confirmar | confirmado | concluido | cancelado`
- `motivo_cancelamento`, `criado_por`, `editado_por`
- Padrão: id, created_at, updated_at + trigger de updated_at

RLS:
- SELECT: enfermeira, executivo_interno, coordenadora, diretora, admin
- INSERT/UPDATE/DELETE: enfermeira, executivo_interno, coordenadora, admin (diretora e demais = read-only)
- GRANT SELECT/INSERT/UPDATE/DELETE para `authenticated`; ALL para `service_role`

### Regras de negócio
- Grade mostra apenas segunda–sexta (`getDay 1..5`).
- Feriados (`isFeriado` de `@/lib/feriados`) bloqueiam criação — toast e abort. Validação também no save.
- PSA restrito a novembro: mês inicial `new Date(ano, 10, 1)`, navegação de mês desabilitada, criação em outros meses = erro.
- Cancelados escondidos da grade (mantidos no banco para export/auditoria).
- Criação múltipla: DayPicker `mode="multiple"` → 1 insert por data. Edição = data única.
- `motivo_cancelamento` obrigatório se status = cancelado.
- Empresa via `EmpresaAutocomplete` existente.

### Arquivos a criar
```
src/modules/saude-empresas/pages/PreventivasCalendario.tsx  (rota)
src/modules/saude-empresas/components/preventivas/
  TipoSelector.tsx         (nível 1)
  CalendarioGrid.tsx       (grade mensal seg-sex)
  PreventivaEventoDialog.tsx (modal CRUD)
  StatusBadge.tsx
src/modules/saude-empresas/hooks/useAcoesPreventivas.ts
```

### Filtros e barra
- Filtros: Empresa (autocomplete), Executiva (`useExecutivas`), Status, botão Limpar.
- Barra: ChevronLeft | Hoje/Novembro | ChevronRight; centro = mês/ano capitalizado; direita = spacer `w-32`.

### Modal
- Campos conforme spec, com `mode="multiple"` na criação e `single` na edição.
- Cancelamento mostra campo motivo obrigatório.
- Rodapé: Excluir (AlertDialog, só edição) | Cancelar | Salvar.
- Executiva default = usuário logado.

### Exportação
Botão "Exportar Excel" chama `exportToExcel` de `@/lib/export-utils`, nome `calendario-<tipo>-YYYY-MM.xlsx` com todas as colunas listadas.

### Permissões
Reusa `usePermissoesSaude`:
- `podeEditar` → CRUD completo
- `isReadOnly` (diretora) → visualiza, sem botões
- outros → rota sem acesso (redirect + toast)

### Design tokens
- Cores só via tokens semânticos do `index.css`.
- Badges de status com as classes exatas da spec (única exceção hardcoded permitida).
- Gradientes só nos 3 cards do Nível 1.
- Números tabulares (`tabular-nums`) nos horários.

### Ordem de execução
1. Migration (tabela + enums + RLS + grants + trigger).
2. Arquivos de UI + hook + rota + link no menu.
3. Verificação de build.
