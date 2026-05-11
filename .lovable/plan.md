## Etapa 18 — Solicitação de Reajuste + Correção de Valores

Refatorar o fluxo para que o perfil **Visualização** apenas **solicite** o reajuste (sem preencher valores nem liberar), e que o **Cadastro** seja o único responsável por registrar valores e liberar. Corrigir também a exibição/cálculo das colunas Retroativo e Valor Final.

---

### 1. Banco (migration)

**Tabela `reajustes_anuais`:**
- Permitir solicitação sem valores: tornar `valor_antigo_centavos`, `percentual`, `valor_reajustado_centavos`, `data_aplicacao` nullable (com default 0 onde aplicável).
- Adicionar status `'solicitado'` como valor permitido em `status_reajuste` (novo estado inicial quando a Visualização cria a solicitação).
- Status válidos finais: `solicitado`, `pendente_confirmacao`, `reajustado`, `liberado`, `retroativo_aplicado`.

**Trigger `trg_reajuste_calc_campos`:**
- Tratar valores nulos: só calcular `valor_reajustado / retroativo / final` quando `valor_antigo` e `percentual` existirem; caso contrário manter zerado.

**Trigger `guard_reajuste_comum`:**
- Bloquear que Visualização altere valores depois que o Cadastro registrou (já bloqueia status/liberação; ampliar para campos financeiros quando status ≠ `solicitado`).

**Função RPC `solicitar_reajuste(p_empresa_id uuid)`** (SECURITY DEFINER):
- Apenas perfil `visualizacao` ou `admin`.
- Cria registro em `reajustes_anuais` com `status_reajuste='solicitado'`, `ano = ano atual`, valores zerados, `usuario_id/nome = solicitante`.
- Trigger `trg_criar_alerta_reajuste` será ajustada para também disparar quando status for `solicitado` (alerta para Cadastro responsável).

**Trigger `trg_criar_alerta_reajuste`:**
- Ampliar condição para criar alerta tanto em `solicitado` quanto `pendente_confirmacao`.
- Mensagem do alerta passa a depender do status (frontend já lê `status_reajuste`).

---

### 2. Frontend — Permissões

`src/pages/Reajustes.tsx`:
- `canCriar` = apenas `isAdmin || isComum` (remover `isViewOnly`).
- `isViewOnly` ganha um botão dedicado **"Solicitar Reajuste"** por linha (em vez de "Registrar"), que chama a RPC `solicitar_reajuste`.
- `podeLiberar`: já está correto (admin ou Cadastro responsável). Garantir que Visualização nunca veja o botão "Liberar".
- Financeiro: apenas leitura (esconder botões de ação).

`src/components/reajustes/ReajusteDialog.tsx`:
- Bloquear abertura para Visualização. Só aparece para Admin/Cadastro.

---

### 3. Tabela — Colunas e Exibição

Confirmar a ordem exata pedida (já está correta no JSX):
`Empresa | Contrato | Implantação | Mês Reajuste | Valor Atual | % | Valor Reajustado | Retroativo | Valor Final | Status | Ações`

Correção de exibição:
- Quando o registro está em `solicitado` (valores zerados), mostrar "—" nas colunas financeiras em vez de `R$ 0,00`.
- Manter `formatCentavosBRL` (BRL com milhar e 2 decimais) — já implementado.
- Garantir que **Retroativo** e **Valor Final** sempre apareçam quando `status_reajuste` for `reajustado / liberado / retroativo_aplicado` (binding já existe; validar que o trigger persiste corretamente).

Status badges:
- `solicitado` → "Solicitado pela Visualização" (laranja)
- `pendente_confirmacao` → "Enviado para Cadastro" (amarelo)
- `reajustado` → verde
- `liberado` → azul
- `retroativo_aplicado` → roxo

Atualizar `labelStatusReajusteFluxo` e `corStatusReajusteFluxo` em `src/lib/reajuste-utils.ts`.

---

### 4. Dashboard do Perfil Visualização

`src/components/reajustes/AlertaReajustesPendentes.tsx`:
- Já lista empresas que chegaram no mês de reajuste e não possuem reajuste no ano. Adicionar coluna **Ações** com botão **"Solicitar Reajuste"** (chama RPC e atualiza lista).
- Empresa só sai da lista quando o Cadastro liberar (status = `reajustado`/`liberado`/`retroativo_aplicado`). Quando a Visualização solicitar, manter a empresa visível com badge "Solicitado".

---

### 5. Alerta para Cadastro

`src/components/reajustes/AlertaReajustesParaConfirmar.tsx`:
- Mensagem condicional pelo `status_reajuste` do alerta:
  - `solicitado` → "Solicitação de reajuste aguardando análise."
  - `pendente_confirmacao` → "Novo reajuste registrado aguardando liberação."
- Continua visível somente para Admin e Cadastro responsável.

---

### Arquivos afetados

- **Migration nova:** ajustar nullables, trigger de cálculo, trigger de alerta, criar RPC `solicitar_reajuste`.
- `src/lib/reajuste-utils.ts` — labels/cores do novo status.
- `src/pages/Reajustes.tsx` — permissões, botão "Solicitar", esconder valores zerados.
- `src/components/reajustes/ReajusteDialog.tsx` — bloquear para Visualização.
- `src/components/reajustes/AlertaReajustesPendentes.tsx` — botão "Solicitar Reajuste".
- `src/components/reajustes/AlertaReajustesParaConfirmar.tsx` — mensagem condicional.

### O que NÃO será alterado

- Lógica de cálculo (`valor_reajustado / retroativo / valor_final`) já correta no trigger SQL.
- RLS de Cadastro responsável (já permite criar/liberar).
- Histórico, exclusão, edição pelo Cadastro.
