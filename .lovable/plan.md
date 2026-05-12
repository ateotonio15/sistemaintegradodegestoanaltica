# Reajuste por Faixa Etária

Adiciona um modo opcional de reajuste por faixa etária dentro dos diálogos de reajuste já existentes (`ReajusteDialog` e `SolicitarReajusteDialog`), preservando o fluxo padrão (valor único por modalidade) e os cálculos atuais.

## 1. Banco de dados

Nova tabela `reajuste_faixas` para armazenar a grade de faixas por reajuste e modalidade.

Campos:
- `reajuste_id` (uuid, FK lógica para `reajustes_anuais.id`, on delete cascade)
- `modalidade` (text: `enfermaria` | `apartamento`)
- `idade_inicial` (smallint)
- `idade_final` (smallint)
- `valor_atual_centavos` (bigint)
- `percentual` (numeric)
- `valor_reajustado_centavos` (bigint)
- `valor_retroativo_centavos` (bigint)
- `valor_final_centavos` (bigint)
- timestamps padrão

Índice único: `(reajuste_id, modalidade, idade_inicial, idade_final)`.

Em `reajustes_anuais`, adicionar:
- `usa_faixa_etaria_enfermaria` boolean default false
- `usa_faixa_etaria_apartamento` boolean default false
- `percentual_unico_enfermaria` boolean default true
- `percentual_unico_apartamento` boolean default true

RLS: replicar políticas de `reajustes_anuais` (admin manage, authenticated read, comum responsável manage, visualizacao manage).

## 2. Faixas obrigatórias (constante no front)

`[0–18, 19–23, 24–28, 29–33, 34–38, 39–43, 44–48, 49–53, 54–58, 59–999]`. Definida em `src/lib/reajuste-utils.ts` como `FAIXAS_ETARIAS`.

## 3. Componente novo

`src/components/reajustes/ReajusteFaixaEtariaTable.tsx`:
- Recebe modalidade, percentual global, mesesRetro, valores iniciais e onChange.
- Renderiza accordion por modalidade contendo tabela com colunas: Faixa, Valor Atual, %, Valor Reajustado, Retroativo, Valor Final.
- Toggle "Usar percentual único" — quando ligado, coluna % fica desabilitada e usa o percentual global; quando desligado, % é editável por linha.
- Cálculos em tempo real reusando `calcularValorReajustadoCentavos`, `calcularRetroativoCentavos`, `calcularValorFinalCentavos`.
- Linha "Total" no rodapé somando Valor Final.
- Animação suave (`animate-fade-in`) e scroll interno em telas pequenas.

## 4. Integração nos diálogos

Em `ReajusteDialog` e `SolicitarReajusteDialog`:
- Dentro de cada bloco de modalidade ativa (Enfermaria/Apartamento), adicionar toggle `"Contrato com Faixa Etária"`.
- Quando ligado: oculta o campo único "Valor Atual" da modalidade e renderiza `ReajusteFaixaEtariaTable`. O cálculo total da modalidade passa a ser a soma dos `valor_final` das faixas (e idem retroativo/reajustado).
- Quando desligado: comportamento atual.
- Validação `podeEnviar`: se modo faixa ativo, exige pelo menos uma faixa com valor > 0 e percentual > 0 (global ou por linha).
- Ao salvar: além do upsert em `reajustes_anuais` (com flags `usa_faixa_etaria_*` e `percentual_unico_*`), `delete + insert` das linhas em `reajuste_faixas` para cada modalidade marcada.
- Ao editar: carregar faixas existentes via select por `reajuste_id`.

## 5. Listagem (`Reajustes.tsx`)

- Ao calcular `usarEnf`/`usarApt`, considerar também `usa_faixa_etaria_*` para preferir esse caminho de exibição.
- Quando reajuste usa faixa: mostrar Badge "Faixa Etária" na coluna Status; campos resumidos (Valor Atual/Reajustado/Retroativo/Final) exibem os totais somados das faixas.
- Linha expandida (sub div já existente) ganha bloco "Faixas Etárias — Enfermaria/Apartamento" com tabela compacta listando cada faixa.

## 6. Regras

- Faixa etária só aparece quando explicitamente ativada por modalidade. Não obrigatório.
- Não mistura valores entre Enfermaria e Apartamento — cada uma tem sua própria grade.
- Faixa 59+ sempre presente (idade_final = 999).
- Reajuste padrão (sem faixa) continua intacto.

## Detalhes técnicos

- Reaproveita utilitários de `src/lib/reajuste-utils.ts`; novas funções: `somarFaixas(faixas)` e `FAIXAS_ETARIAS` constante.
- Persistência das faixas dentro do mesmo `mutationFn` para manter atomicidade lógica (ordem: upsert reajuste → delete/insert faixas).
- Sem alterações em RPCs existentes (`solicitar_reajuste` continua gerando o registro base; faixas são preenchidas no update subsequente).
- Tipos do Supabase serão regenerados automaticamente após a migration.

## Fora de escopo

- Não alterar lógica do Financeiro nem importação Excel.
- Não mexer em `reajustes` (tabela legada de cobrança), apenas `reajustes_anuais`.
