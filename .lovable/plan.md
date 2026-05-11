## Etapa 16 — Regra Oficial de Reajuste Contratual com Retroativo

Estende a aba Reajuste para usar a **data de Implantação** como base oficial do mês de reajuste e calcular automaticamente **valor reajustado + retroativo + valor final**, mantendo histórico auditável.

### 1. Banco (migration)

Adicionar à tabela `reajustes_anuais`:
- `mes_reajuste` (smallint 1–12) — derivado da `data_implantacao` (mês oficial do reajuste)
- `meses_retroativos` (smallint default 0)
- `valor_retroativo_centavos` (bigint default 0)
- `valor_final_centavos` (bigint) — `valor_reajustado + valor_retroativo`
- `competencia` (text, formato `MM/AAAA`) — competência aplicada
- `data_liberacao` (timestamptz nullable)
- `liberado_por` (uuid nullable) + `liberado_por_nome` (text)
- Status estendido: `status_reajuste` aceita `pendente_confirmacao | reajustado | liberado | retroativo_aplicado` (constraint atualizada)

Atualizar `guard_reajuste_comum` para também bloquear edição dos novos campos por perfil Comum (Cadastro segue só confirmando).

Criar trigger `trg_reajuste_calc_campos` (BEFORE INSERT/UPDATE) que recomputa em SQL:
- `valor_reajustado_centavos = round(valor_antigo * (1 + percentual/100))`
- `meses_retroativos`, `valor_retroativo_centavos`, `valor_final_centavos` a partir de `mes_reajuste` e `data_aplicacao` (timezone `America/Manaus`)
- garante consistência mesmo se cliente enviar valores divergentes (regra "não permitir cálculo manual divergente")

Índice único `(empresa_id, ano)` já existe — manter.

### 2. Lógica (frontend `src/lib/reajuste-utils.ts`)

Novas funções puras (timezone Manaus, sem UTC drift):
- `getMesReajuste(dataImplantacao)` → 1–12
- `calcularMesesRetroativos(mesReajuste, dataAplicacao)` → diferença em meses dentro do mesmo ano de aplicação (mínimo 0)
- `calcularRetroativoCentavos(valorAntigo, valorReajustado, mesesAtrasados)`
- `calcularValorFinalCentavos(valorReajustado, retroativo)`
- `getStatusReajusteEmpresa()` atualizado: usa `mes_reajuste` da implantação (não mais "abril fixo") para definir Atrasado vs Pendente
- Tipo `StatusReajusteFluxo` ampliado para `pendente_confirmacao | reajustado | liberado | retroativo_aplicado` com labels e cores (Amarelo / Verde / Azul / Roxo)

### 3. UI

**`ReajusteDialog.tsx`** — preview de cálculo expandido:
- Mostrar (read-only): Mês de reajuste oficial (da implantação), Meses retroativos calculados, Valor retroativo, **Valor final cobrança**
- Recalcula em tempo real conforme percentual/data muda
- Validação: bloqueia salvar se já existe reajuste no ano (mensagem clara)

**`Reajustes.tsx`** — colunas conforme spec:
Empresa | Contrato | Implantação | Mês Reajuste | Valor Antigo | % | Valor Reajustado | Retroativo | Valor Final | Status | Ações

Ações por perfil:
- Admin/Visualização: criar / editar / excluir / **Liberar**
- Cadastro (Comum): apenas Confirmar quando status `pendente_confirmacao`
- Botão **Liberar** (Admin/Visualização) abre confirmação e grava `data_liberacao`, `liberado_por`, `competencia` (MM/AAAA), muda status para `liberado` (ou `retroativo_aplicado` se `meses_retroativos > 0`)

**`AlertaReajustesPendentes.tsx`** — atualizar:
- Conta empresas onde `mes_atual >= mes_reajuste(data_implantacao)` e sem reajuste no ano
- Mensagem: "Contrato pendente de reajuste anual"
- Adicionar variante "Retroativo pendente" para reajustes com `meses_retroativos > 0` ainda não liberados

**`ReajusteHistoricoDialog.tsx`** — exibir colunas adicionais (retroativo, valor final, liberado por, data liberação, competência).

### 4. Detalhes técnicos

- Timezone: usar utilitários existentes em `src/lib/date-utils.ts` (manter padrão America/Manaus já em uso no projeto). Toda construção manual `new Date(yyyy, mm-1, dd)`.
- Realtime já configurado em `reajustes_anuais` — manter, novos campos chegam automaticamente.
- `src/integrations/supabase/types.ts` é regenerado pela migration (não editar manual).

### 5. Arquivos afetados

```text
supabase/migrations/<novo>.sql           (campos + trigger calc + guard atualizado)
src/lib/reajuste-utils.ts                (funções de mês/retroativo/final + status estendidos)
src/components/reajustes/ReajusteDialog.tsx        (preview com retroativo/final)
src/components/reajustes/ReajusteHistoricoDialog.tsx (colunas extras)
src/components/reajustes/AlertaReajustesPendentes.tsx (regra mes_reajuste + retroativo)
src/pages/Reajustes.tsx                  (colunas novas + ação Liberar)
```

### Não faz parte do escopo

- Não recalcula reajustes históricos já salvos (apenas novos passam pelo trigger; existentes ficam como estão até serem editados).
- Não duplica registro no mesmo ano (constraint mantida).
- Não permite edição por perfis sem autorização (guard mantido).
