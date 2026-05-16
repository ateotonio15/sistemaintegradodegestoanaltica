# Modernização Visual do CS Control

Refinar toda a interface mantendo a identidade atual (verde + dark), elevando o sistema para um padrão SaaS moderno (estilo Linear/Vercel), com micro-interações sutis e profissionais.

## Princípios de design

- **Manter**: paleta verde primário, dark mode default, fonte Inter, estrutura shadcn/ui.
- **Elevar**: hierarquia visual, respiração (espaçamentos), profundidade sutil, consistência entre telas.
- **Interatividade nível 3/5**: transições suaves, hover states refinados, feedback claro — sem exageros.

## 1. Design tokens (base do sistema)

Arquivos: `src/index.css`, `tailwind.config.ts`

- Refinar paleta HSL: verde primário com glow secundário, surfaces em camadas (bg, card, elevated, overlay).
- Adicionar tokens semânticos: `--surface-1/2/3`, `--border-subtle`, `--ring-focus`, `--shadow-elegant`, `--shadow-glow`.
- Gradientes utilitários: `--gradient-primary`, `--gradient-surface`.
- Border radius: subir levemente (cards `rounded-xl → rounded-2xl` seletivo).
- Tipografia: escala mais clara (display, h1-h4, body, caption) com tracking ajustado.

## 2. Componentes globais

- **Sidebar** (`AppLayout.tsx`, `NavLink.tsx`): item ativo com indicador lateral verde + bg sutil, ícones com leve glow no hover, agrupamento visual mais limpo, transição suave de colapso.
- **Header**: altura padronizada, busca global com estilo command-palette, badge de notificações refinado.
- **Cards** (`KpiCards`, `PeriodSummary`, etc.): borda mais suave, hover com lift sutil (`translate-y` + shadow), ícones em containers com gradiente.
- **Tabelas** (`FinanceiroTable`, listagens): linhas zebradas opcionais, hover row destacado, header sticky com blur, badges de status com pill refinado.
- **Botões**: variante `premium` com gradiente verde + glow, estados loading consistentes.
- **Dialogs/Sheets**: overlay com blur, animação `scale-in` + `fade-in`, header com divisor sutil.
- **Inputs/Selects**: focus ring verde discreto, transição de borda.
- **Empty states**: ilustração mínima + CTA claro.
- **Skeletons**: padrão consistente para loading em todas as listagens.

## 3. Páginas (aplicação dos novos padrões)

Aplicar os componentes refinados em:

- Dashboard (Cadastro e Financeiro)
- Empresas / Implantação
- Financeiro (tabela, KPIs, resumos)
- Arquivos (cards de contrato/competência)
- Reajustes
- Movimentações
- Executivas
- Saúde nas Empresas
- Usuários, Auth

Sem mudar lógica/comportamento — apenas estrutura visual, espaçamentos, classes e micro-animações.

## 4. Micro-interações (nível 3/5)

- `fade-in` ao montar listas e cards
- `hover-scale` sutil (1.02) em cards clicáveis
- Transição de cor 200ms em todos os interativos
- Badges de status com leve pulse quando "Fora do prazo"
- Tabs com indicador deslizante
- Toasts com slide-in suave

## Execução em fases

1. **Fundação**: tokens, tema, tipografia, componentes base (Button, Card, Badge, Input, Table, Dialog).
2. **Shell**: Sidebar, Header, layout geral.
3. **Páginas core**: Dashboard, Financeiro, Empresas.
4. **Demais telas**: Arquivos, Reajustes, Movimentações, Executivas, Saúde, Usuários.
5. **Polish**: animações, empty states, skeletons, revisão final.

## Detalhes técnicos

- Tudo via tokens semânticos HSL no `index.css` — zero cores hardcoded em componentes.
- Variantes via `class-variance-authority` nos componentes shadcn customizados.
- Animações usando keyframes do `tailwind.config.ts` (já existentes: `fade-in`, `scale-in`, `accordion-*`) + adições mínimas (`slide-up`, `shimmer`).
- Sem mudanças em lógica de negócio, RLS, queries ou estruturas de dados.
- Sem novas dependências.

## Fora de escopo

- Mudanças funcionais ou de regras de negócio
- Alterações em banco/RLS/Edge Functions
- Troca de paleta principal
- Reestruturação de navegação/rotas
