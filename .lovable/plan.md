## Etapa 17 — Correções da Aba Reajuste

### 1. Renomear "Valor Antigo" → "Valor Atual"
Apenas rótulos de UI (manter coluna `valor_antigo_centavos` no banco para evitar migrações destrutivas):
- `src/pages/Reajustes.tsx`: cabeçalho da tabela.
- `src/components/reajustes/ReajusteDialog.tsx`: label do campo, preview e mensagens.
- `src/components/reajustes/ReajusteHistoricoDialog.tsx`: cabeçalho.
- `src/components/reajustes/AlertaReajustesPendentes.tsx` e `AlertaReajustesParaConfirmar.tsx`: textos.
- Dashboard (cards/lista de reajuste) se houver referência textual.

### 2 & 3. Garantir exibição de Retroativo e Valor Final
A tabela em `Reajustes.tsx` já renderiza, mas:
- No `ReajusteDialog.tsx` revisar painel de cálculo: exibir explicitamente **Valor Reajustado**, **Meses Retroativos**, **Valor Retroativo**, **Valor Final = Reajustado + Retroativo** com destaques.
- No `ReajusteHistoricoDialog.tsx` adicionar (ou confirmar) colunas: Valor Atual, %, Valor Reajustado, Retroativo (valor + meses), Valor Final, Liberado por, Data Liberação, Competência.
- No card/lista do Dashboard mostrar Valor Final quando reajuste já existir.

### 4 & 5 & 6. Reorganizar permissões e fluxo de status

Fluxo correto:
```
Visualização ou Cadastro registra reajuste
  → status_reajuste = 'pendente_confirmacao'
  → label: "Enviado para Cadastro" (badge amarelo)
Cadastro responsável clica "Liberar"
  → status_reajuste = 'reajustado' (ou 'retroativo_aplicado' se houver retroativo)
  → registra liberado_por, data_liberacao, competencia
  → label: "Reajustado" (verde) / "Retroativo Aplicado" (roxo)
```

Mudanças em `Reajustes.tsx`:
- `canCriar = isAdmin || isViewOnly || isComum` (Cadastro também pode criar/editar).
- `canLiberar(empresa) = isComum && empresa.responsavel_user_id === user.id` **ou** `isAdmin`. Visualização **não** libera mais.
- Remover botão "Confirmar" separado — unificar em **"Liberar"** (única ação do Cadastro responsável que muda status para `reajustado`/`retroativo_aplicado`).
- Botão "Liberar" só aparece quando `status_reajuste === 'pendente_confirmacao'` e o usuário é Cadastro responsável (ou Admin).
- Mutation `liberarMutation` passa a também marcar `confirmado_por`/`data_confirmacao` (mantém auditoria).

Banco (migração — `guard_reajuste_comum`):
- Atualizar trigger para **permitir** que Comum responsável pela empresa: insira novos reajustes, edite valores quando ainda em `pendente_confirmacao`, e altere status/liberação. Bloqueio se mantém para Comum **não responsável**.
- Atualizar política RLS `Comum confirm reajustes_anuais` para incluir INSERT/DELETE pelo Comum responsável (atualmente só UPDATE).
- Remover/ajustar política `Visualizacao manage reajustes_anuais`: manter INSERT/UPDATE de campos de criação, mas o trigger garante que só Comum/Admin altere `status_reajuste` para `reajustado/liberado/retroativo_aplicado` e preencha `liberado_por/data_liberacao`.

### 7. Alerta automático para Cadastro
Já existe trigger `trg_criar_alerta_reajuste`. Ajustar apenas o texto exibido em `AlertaReajustesParaConfirmar.tsx` para:
> "Novo reajuste registrado aguardando liberação."

### 8 & 9 & 10. Dashboard exclusivo do perfil Visualização
Em `src/pages/Dashboard.tsx`:
- Renderizar `AlertaReajustesPendentes` (lista operacional de empresas que precisam registrar reajuste no mês) **somente** quando `isViewOnly === true`. Esconder para Admin, Cadastro, Financeiro, Executivo, Enfermeira.
- O componente `AlertaReajustesPendentes.tsx` deve listar apenas contratos onde:
  - `mes_reajuste(data_implantacao) === mês_atual` (ou já passou no ano);
  - sem reajuste no `ano atual`.
- Colunas exibidas: Empresa, Contrato, Implantação, Mês Reajuste, **Valor Atual** (do último reajuste anterior, se houver), Último Reajuste (data + %), Status (Pendente/Atrasado).
- Manter `AlertaReajustesParaConfirmar` visível apenas para Cadastro responsável (já é o caso) e Admin.

### 11. Cálculos (sem mudança de regra, apenas garantir consistência)
Já implementados no trigger SQL `trg_reajuste_calc_campos` e em `src/lib/reajuste-utils.ts`. Apenas validar que o preview do Dialog usa as mesmas funções e o label "Valor Atual" reflete `valor_antigo_centavos`.

### 12. Status / Labels
Atualizar `labelStatusReajusteFluxo` em `src/lib/reajuste-utils.ts`:
- `pendente_confirmacao` → "Enviado para Cadastro" (amarelo)
- `reajustado` → "Reajustado" (verde)
- `liberado` → "Liberado" (azul)
- `retroativo_aplicado` → "Retroativo Aplicado" (roxo)

---

### Arquivos afetados
- **Migração SQL** (nova): atualizar `guard_reajuste_comum` + políticas RLS de `reajustes_anuais`.
- `src/pages/Reajustes.tsx` — permissões, botões, rótulo coluna.
- `src/pages/Dashboard.tsx` — gating do alerta de pendentes apenas para Visualização.
- `src/components/reajustes/ReajusteDialog.tsx` — label "Valor Atual", preview reforçado.
- `src/components/reajustes/ReajusteHistoricoDialog.tsx` — colunas completas, label.
- `src/components/reajustes/AlertaReajustesPendentes.tsx` — colunas + label "Valor Atual".
- `src/components/reajustes/AlertaReajustesParaConfirmar.tsx` — nova mensagem.
- `src/lib/reajuste-utils.ts` — sem mudança de regra; só ajuste de comentários se necessário.

### Garantias (NÃO FAÇA)
- Status nunca muda para `reajustado` sem ação explícita do Cadastro responsável (ou Admin).
- Retroativo e Valor Final sempre visíveis em tabela, dialog e histórico.
- Visualização perde o botão "Liberar".
- Lista operacional do Dashboard só renderiza para Visualização.
