## Objetivo
Trocar o Dark Mode atual (azulado) por uma identidade verde corporativa premium — inspirada em Linear, Vercel, Supabase. Mudanças concentradas em tokens CSS; light mode permanece intacto.

## Escopo
- Apenas o bloco `.dark` em `src/index.css` (tokens HSL).
- Sem alterar componentes — todos já usam tokens semânticos (`bg-background`, `bg-card`, `border`, `primary`, etc.).
- Sem mexer em lógica, dados ou rotas.

## Nova paleta (.dark)

Conversão dos hex pedidos para HSL (formato exigido pelo Tailwind):

```text
Background      #0F1512  → 140 14%  7%
Secondary       #131D18  → 145 20%  9%   (usado em --secondary, --muted, --accent base)
Card / Popover  #18241E  → 147 21% 12%
Hover           #1E2D25  → 147 20% 15%   (usado em sidebar-accent / hover states)
Border / Input  #284136  → 150 24% 20%
Primary         #22C55E  → 142 71% 45%
Primary hover   #16A34A  → 142 76% 36%   (via ring/glow)
Foreground      #F3F4F6  → 220 14% 96%
Muted text      #A1A1AA  → 240  5% 65%
Subtle text     #71717A  → 240  4% 46%
```

## Mudanças em `src/index.css` (bloco `.dark`)

- `--background: 140 14% 7%`
- `--foreground: 220 14% 96%`
- `--card / --popover: 147 21% 12%`, foreground `220 14% 96%`
- `--primary: 142 71% 45%`, `--primary-foreground: 145 30% 8%`
- `--secondary / --muted / --accent: 145 20% 9%` (com hover states em `147 20% 15%` via componentes que já usam `accent`)
- `--muted-foreground: 240 5% 65%`
- `--border / --input: 150 24% 20%`
- `--ring: 142 71% 45%`
- `--destructive: 0 65% 55%` (vermelho menos saturado)
- `--success: 142 71% 45%`
- `--warning: 38 88% 55%` (âmbar suave)
- `--info: 160 60% 45%` (teal, removendo azul)
- Charts (remover azul):
  - `--chart-1: 142 71% 45%` (emerald)
  - `--chart-2: 160 60% 45%` (teal)
  - `--chart-3: 38 88% 55%` (âmbar)
  - `--chart-4: 84 60% 50%` (lime discreto)
  - `--chart-5: 170 50% 40%` (verde petróleo)
- Sidebar:
  - `--sidebar / --sidebar-background: 147 21% 10%`
  - `--sidebar-foreground: 220 14% 96%`
  - `--sidebar-primary: 142 71% 45%`
  - `--sidebar-accent: 142 50% 18%` (hover verde translúcido sólido equivalente)
  - `--sidebar-accent-foreground: 142 70% 75%` (≈ #4ADE80)
  - `--sidebar-border: 150 24% 18%`
  - `--sidebar-ring: 142 71% 45%`
- `--icon: 142 71% 45%`
- Sombras: ajustar `--shadow-*` para tom verde sutil usando `hsl(142 60% 5% / α)` em vez de preto puro (glow elegante).

## Verificação
- Abrir `/dashboard`, `/financeiro`, `/arquivos`, `/reajustes` no dark mode e conferir: sidebar, cards, inputs, tabelas (hover), modais, gráficos (Recharts usam `chart-*`), badges de status.
- Garantir contraste AA do texto sobre `background` e `card`.
- Nenhum azul remanescente em foco/ring/hover.

## Não fazer
- Não tocar no light mode.
- Não alterar componentes individuais (paleta é toda via tokens).
- Sem cores neon ou saturadas demais.
