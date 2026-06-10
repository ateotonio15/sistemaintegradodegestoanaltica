
# Módulo Saúde nas Empresas — Plano Completo

Substitui o módulo de Saúde atual (`SaudeAcoes`, `SaudeCalendario`, `SaudePalestras`, `SaudePreventivas` e tabelas `saude_acoes` / `saude_agendamentos`) por uma estrutura nova, mais profunda, focada em ações de saúde corporativas com triagens clínicas e ficha de bioimpedância.

---

## 1. Rotas e permissões

| Rota | Componente | Quem acessa |
|---|---|---|
| `/saude-empresas` | `SaudeEmpresasLista` (Tela 1) | Admin, Enfermeira, Executivo, Coordenadora, Diretora |
| `/saude-empresas/empresa/:empresaId` | `SaudeEmpresaAcoes` (Tela 2) | Admin, Enfermeira (criar/editar), demais (ver) |
| `/saude-empresas/acao/:acaoId` | `SaudeAcaoTriagens` (Tela 3) | Admin, Enfermeira (criar/editar/excluir triagens), demais (ver + exportar) |
| `/saude-empresas/visao-geral` | `SaudeVisaoGeral` (Dashboard) | Admin, Coordenadora, Diretora, Executivo |

Mapeamento de roles (perfis já existentes): `admin`, `enfermeira` e `executivo` já existem. Vou adicionar dois novos no enum `app_role`: **`coordenadora`** e **`diretora_saude`** (já existe `diretora` para reajustes; criaremos `diretora_saude` para isolar).

Regras frontend via novos helpers em `useAuth`: `isCoordenadoraSaude`, `isDiretoraSaude`. Botões de mutação só aparecem para `admin` ou `enfermeira`.

---

## 2. Modelo de dados

Remover (drop cascade) `saude_acoes` e `saude_agendamentos` e suas referências em código.

### `public.acoes_saude`
Cabeçalho de uma ação realizada em uma empresa:
- `empresa_id`, `enfermeira_user_id`, `enfermeira_nome`
- `data_acao`, `hora_inicio`, `hora_fim`
- `tipo` enum (`triagem`, `palestra`, `preventiva`, `bioimpedancia`, `outro`)
- `titulo`, `local`, `observacoes`, `total_atendidos` (gerado por trigger)
- `status` enum (`agendada`, `em_andamento`, `concluida`, `cancelada`)

### `public.triagens` (~30 campos da ficha bio)
1 linha por colaborador atendido dentro de uma ação:
- FK `acao_id`, `empresa_id`
- Identificação: `nome`, `cpf`, `data_nascimento`, `idade` (gerado), `sexo`, `email`, `telefone`, `setor`, `cargo`
- Antropometria: `peso_kg`, `altura_cm`, `imc` (gerado), `circ_abdominal_cm`, `circ_quadril_cm`, `rcq` (gerado), `gordura_pct`, `massa_muscular_kg`, `massa_ossea_kg`, `agua_corporal_pct`, `tmb_kcal`, `idade_metabolica`, `gordura_visceral`
- Sinais vitais e exames: `pas_mmhg`, `pad_mmhg`, `classificacao_pa` (gerado), `freq_cardiaca`, `sat_o2`, `temperatura_c`, `glicemia_mg_dl`, `jejum` (bool), `classificacao_glicemia` (gerado)
- Histórico: `tem_has` (bool), `tem_dm` (bool), `usa_medicacao`, `medicamentos` (text)
- Bio extra: `gordura_corporal_kg`, `gordura_subcutanea_pct`, `score_corporal`
- Encaminhamento: `risco_geral` (gerado), `recomendacao` (text), `enviado_email_em` (timestamptz)

Geração: trigger BEFORE INSERT/UPDATE calcula `imc`, `rcq`, `idade`, `classificacao_pa`, `classificacao_glicemia`, `risco_geral` (alto/medio/baixo). Não usamos CHECK time-dependent.

### Funções SECURITY DEFINER
- `public.is_saude_editor(uid)` — true para `admin` ou `enfermeira`
- `public.classificar_pa(pas int, pad int) → text`
- `public.classificar_glicemia(valor numeric, jejum boolean) → text`
- `public.calcular_imc(peso numeric, altura_cm int) → numeric`
- `public.calcular_risco(...) → text`
- `public.recount_atendidos(acao uuid) → void` chamado por trigger AFTER INS/DEL na triagens

### GRANT + RLS (padrão)
Para cada tabela nova:
```
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
GRANT ALL ON public.<t> TO service_role;
ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;
```
Policies:
- SELECT: qualquer `authenticated` (todos perfis listados)
- INSERT/UPDATE/DELETE: `public.is_saude_editor(auth.uid())`

---

## 3. Regras clínicas (constantes em `src/lib/saude-rules.ts`)

### Pressão arterial
| Categoria | PAS | PAD |
|---|---|---|
| Ótima | <120 | <80 |
| Normal | 120–129 | 80–84 |
| Limítrofe | 130–139 | 85–89 |
| HA Estágio 1 | 140–159 | 90–99 |
| HA Estágio 2 | 160–179 | 100–109 |
| HA Estágio 3 | ≥180 | ≥110 |

Usa a pior classificação entre PAS e PAD.

### Glicemia (mg/dL)
- Jejum: <70 hipo · 70–99 normal · 100–125 pré-DM · ≥126 DM
- Pós-prandial / casual: <140 normal · 140–199 pré-DM · ≥200 DM

### IMC
`imc = peso / (altura_m)^2` — Baixo <18.5 · Normal 18.5–24.9 · Sobrepeso 25–29.9 · Obesidade I 30–34.9 · II 35–39.9 · III ≥40.

### Risco geral
Alto se HA Estágio 2+, glicemia DM, IMC ≥30 ou histórico HAS+DM. Médio se limítrofe/pré-DM/sobrepeso. Caso contrário baixo.

---

## 4. Telas

### Tela 0 — Visão Geral (`/saude-empresas/visao-geral`)
KPIs: empresas atendidas no mês, ações concluídas, triagens realizadas, % risco alto. Gráficos: barras (triagens por empresa), pizza (distribuição de risco).

### Tela 1 — Lista de empresas (`/saude-empresas`)
- Filtros: período (date range), responsável (enfermeira), tipo de ação, busca por nome/contrato
- Agregação por empresa: total de ações, total de triagens, última ação, risco médio
- Toggle Grade/Lista (cards x tabela)
- Botão "Nova ação" abre modal global (escolhe empresa)

### Tela 2 — Ações da empresa (`/empresa/:empresaId`)
- Header com nome/contrato + KPIs (ações ano, triagens ano)
- Cards de ação (data, tipo, enfermeira, total atendidos, status)
- Botões editar/excluir (com confirm); exclusão deleta triagens em cascata (FK ON DELETE CASCADE)
- Botão "Nova ação" pré-seleciona empresa

### Tela 3 — Triagens da ação (`/acao/:acaoId`)
- Header da ação + breadcrumb
- 6 cards de métricas: total triagens, % HAS, % DM, % obesidade, % risco alto, IMC médio
- 2 gráficos Recharts:
  - Barras coloridas: distribuição classificação PA (verde/amarelo/laranja/vermelho)
  - Pizza: distribuição IMC
- Formulário inline (11 campos rápidos): Nome, CPF (mask `999.999.999-99`), PAS, PAD, classificação PA em tempo real (badge), Jejum (switch), Glicemia, HAS (switch), DM (switch), Bio (botão abre modal completo)
- Tabela com triagens (edit/delete)
- Modal de edição idem formulário + todos os campos avançados
- Modal Bioimpedância: todos os ~30 campos antropométricos. Footer com 2 botões: **Salvar** e **Salvar e enviar por e-mail** → invoca Edge Function `enviar-ficha-bio`

---

## 5. Edge Function `enviar-ficha-bio`
Usa connector Resend. Payload: `{ triagem_id }`. Busca triagem + empresa, monta HTML da ficha (template), envia para `triagem.email`. Atualiza `enviado_email_em = now()`.

Secrets necessários: `LOVABLE_API_KEY` (já existe), `RESEND_API_KEY` (vou pedir). `verify_jwt = true` (default).

---

## 6. Exportações

`src/lib/saude-export.ts`:
- **Excel** (`xlsx`): `triagens_<empresa>_<acao>_<data>.xlsx` com colunas: Nome, CPF, Idade, Sexo, Setor, Peso, Altura, IMC, Classif. IMC, PAS, PAD, Classif. PA, FC, SatO2, Glicemia, Jejum, Classif. Glicemia, HAS, DM, Risco, Recomendação
- **PowerPoint** (`pptxgenjs`): `relatorio_saude_<empresa>_<data>.pptx` com slide capa + KPIs + gráficos PA/IMC + tabela top 10 risco alto

---

## 7. Convenções globais

- Datas ISO no DB; UI usa `formatDateBR` / construções locais (memória do projeto)
- Toasts via `sonner`
- Tokens HSL semânticos (sem `text-white` cru)
- RLS dupla: policies + checagem de role nas mutations do frontend (botão escondido)

---

## 8. Plano de execução

1. **Secret**: pedir `RESEND_API_KEY` via `add_secret`
2. **Migração**: drop tables antigas, criar enum + tabelas novas + triggers/funções + GRANT + RLS + role `coordenadora`/`diretora_saude`
3. **Limpeza de código**: remover páginas/components/hook antigos de saúde, retirar rotas em `App.tsx`, links em `Home.tsx` e `AppLayout.tsx`
4. **Novo módulo** em `src/modules/saude-empresas/`:
   - `lib/saude-rules.ts`, `lib/saude-export.ts`
   - `hooks/useAcoesSaude.ts`, `hooks/useTriagens.ts`
   - `components/`: `NovaAcaoDialog`, `TriagemInlineForm`, `TriagemEditDialog`, `BioimpedanciaDialog`, `PaBadge`, `MetricCard`
   - `pages/`: `SaudeVisaoGeral`, `SaudeEmpresasLista`, `SaudeEmpresaAcoes`, `SaudeAcaoTriagens`
5. **Rotas** em `App.tsx`, sidebar em `AppLayout.tsx`, atalhos em `Home.tsx`
6. **Edge Function** `supabase/functions/enviar-ficha-bio/index.ts` via gateway Resend
7. **bun add** `pptxgenjs` (xlsx já existe)
8. **Memória**: atualizar `mem://features/saude-nas-empresas` e core index

### Riscos
- A migração apaga dados existentes em `saude_acoes`/`saude_agendamentos`. Confirmado pelo usuário (substituir).
- `pptxgenjs` adiciona ~500kb; aceitável.

### Próximo passo após aprovação
Vou pedir o `RESEND_API_KEY`, rodar a migração e implementar tudo nessa ordem.
