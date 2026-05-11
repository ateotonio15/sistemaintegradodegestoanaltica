## Etapa 20 — Solicitação obrigatória com Percentual + Valor Atual

Hoje o botão "Solicitar Reajuste" do perfil Visualização chama direto o RPC `solicitar_reajuste`, criando o registro com valores zerados. Vamos transformar essa ação num modal obrigatório com cálculo em tempo real.

## Mudanças

### 1. Novo componente `src/components/reajustes/SolicitarReajusteDialog.tsx`

Modal dedicado para o perfil Visualização (e Admin via mesmo botão). Conteúdo:

- Cabeçalho: nome da empresa + contrato + mês oficial de reajuste (read-only).
- Campos obrigatórios:
  - **Valor Atual (R$)** — máscara decimal BRL.
  - **Percentual (%)** — decimal.
- Campos opcionais:
  - **Previsão de aplicação** (`data_aplicacao`, default = hoje).
  - **Observação**.
- Bloco de preview em tempo real (reaproveita `calcularValorReajustadoCentavos`, `calcularMesesRetroativos`, `calcularRetroativoCentavos`, `calcularValorFinalCentavos` de `reajuste-utils`):
  - Valor Reajustado
  - Meses retroativos
  - Retroativo
  - **Valor Final** (destaque)
- Validação no botão "Enviar para Cadastro":
  - desabilitado quando `valorAntigoCent <= 0` ou `pct <= 0`.
  - ao clicar com vazio, toast: "Preencha o percentual de reajuste." / "Preencha o valor atual."
- Submit:
  1. `supabase.rpc("solicitar_reajuste", { p_empresa_id })` — cria a linha em `solicitado` (RLS já permite Visualização/Admin).
  2. Em seguida `supabase.from("reajustes_anuais").update({ valor_antigo_centavos, percentual, data_aplicacao, observacao }).eq("id", novoId)` — o trigger `trg_reajuste_calc_campos` calcula `valor_reajustado/retroativo/final` automaticamente. Status permanece `solicitado` (Cadastro continua sendo quem confirma/libera, conforme item 7 do briefing).
  3. Invalidate `reajustes-anuais`, `reajustes-pendentes-list`, `alertas-reajuste-count`.
  4. Toast: "Solicitação enviada — Cadastro responsável foi notificado."

Observação técnica: o RPC atual já cria com 0/0/0; o `update` posterior dispara o trigger BEFORE UPDATE (já anexado na etapa anterior) recalculando todos os campos. RLS `Visualizacao manage reajustes_anuais` cobre o update.

### 2. `src/pages/Reajustes.tsx`

- Remover a `solicitarMutation` direta e o estado `solicitandoId`.
- Adicionar estado `solicitarOpen` + `solicitarEmpresa`.
- Botão "Solicitar Reajuste" (linhas 394–404) passa a abrir o novo modal:
  ```tsx
  onClick={() => { setSolicitarEmpresa(empresa); setSolicitarOpen(true); }}
  ```
- Renderizar `<SolicitarReajusteDialog open={solicitarOpen} onOpenChange={setSolicitarOpen} empresa={solicitarEmpresa} />` ao lado dos outros dialogs.

### 3. Sem mudanças no banco

Triggers e RPC `solicitar_reajuste` já existem e fazem o cálculo + alerta correto na sequência insert → update.

## Não será feito

- Não alterar `ReajusteDialog` (continua sendo o fluxo do Cadastro).
- Não alterar status automaticamente: Cadastro continua liberando.
- Não tocar em RLS, triggers ou tipos.
- Não esconder colunas Retroativo/Valor Final.
