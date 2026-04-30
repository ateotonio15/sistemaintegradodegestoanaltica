# Modernização da Página de Login

Refatorar `src/pages/Auth.tsx` para um visual **Clean & Professional**, mantendo a identidade verde da marca e o logo atual.

## Lado Esquerdo — Hero com gradiente e padrão

- Substituir o `<img>` de fundo sólido por uma seção com **gradiente diagonal suave** usando os tons de verde da marca (variações do `--primary` HSL `152 69% 40%`).
  - Exemplo: `bg-gradient-to-br from-[hsl(152_69%_35%)] via-[hsl(152_60%_45%)] to-[hsl(160_55%_30%)]`.
- Adicionar **padrão geométrico suave** sobreposto (baixa opacidade, ~8–12%) para preencher o espaço de forma profissional. Implementação via SVG inline em `background-image` com pequenos círculos/grade, ou pattern de losangos. Sem dependências novas.
- Centralizar o **logo atual** (`@/assets/login-bg.png` será substituído por uma renderização centralizada do logo da marca; se preferir manter a imagem atual como logo, ela será exibida com tamanho contido — `max-w-xs`) com **respiro maior** (padding generoso, `p-16`).
- Abaixo do logo, um pequeno bloco textual opcional com nome do produto em branco e subtítulo discreto (mantendo "CS Control — Cadastro Samel e Gestão Empresarial").

## Lado Direito — Card de Login

- Fundo da coluna em `bg-background` (cinza muito claro) para destacar o card.
- **Card branco** centralizado:
  - `bg-card`, `rounded-xl`, `shadow-lg`, `border border-border/50`.
  - Padding interno generoso (`p-8` a `p-10`).
  - Largura `max-w-md` com `w-full`.
- Cabeçalho dentro do card: título "Bem-vindo de volta" e subtítulo "Faça login para acessar o sistema", tipografia Inter (já configurada), pesos 600/400.

## Inputs com Ícones

- Usar wrapper `relative` com ícone `lucide-react` posicionado absolutamente à esquerda:
  - Campo Usuário: ícone `User`.
  - Campo Senha: ícone `Lock`.
- Input estilizado:
  - `pl-10` para dar espaço ao ícone.
  - Bordas finas (`border` padrão) com cor `border-input`.
  - Foco em verde principal: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary`.
  - Altura confortável `h-11`, cantos `rounded-lg`.
- Labels acima dos inputs com `text-sm font-medium text-foreground`.

## Botão "Entrar"

- Largura total (`w-full`), altura `h-11`, `rounded-lg`, `font-semibold`.
- Cor primária verde (já é o default do botão shadcn).
- Hover atraente: leve elevação + escurecimento — `hover:bg-primary/90 hover:shadow-md transition-all duration-200`.
- Mantém o ícone `LogIn` à esquerda e o estado `loading`.

## Responsividade

- Em telas `< lg`: o lado esquerdo (hero) é ocultado (`hidden lg:flex`), o card de login ocupa a tela toda mantendo o mesmo estilo elegante e centralizado.

## Detalhes Técnicos

- **Arquivo único alterado:** `src/pages/Auth.tsx`.
- **Sem mudanças** em `index.css`, `tailwind.config.ts` ou tokens — o verde já está em `--primary` e a fonte Inter já é o `--font-sans`.
- **Sem novas dependências** — `lucide-react` (`User`, `Lock`, `LogIn`) já está disponível.
- O padrão geométrico será um SVG inline em `data:image/svg+xml` aplicado como `backgroundImage` no estilo da seção esquerda, garantindo zero requisições extras.
- Toda a lógica de autenticação (`handleSubmit`, RPC `get_email_by_username`, `signInWithPassword`) permanece **inalterada** — apenas apresentação.

## Estrutura Resultante (esboço)

```text
┌─────────────────────────┬──────────────────────────┐
│  Gradiente verde        │   bg-background          │
│  + padrão geométrico    │                          │
│                         │   ┌──────────────────┐   │
│        [ LOGO ]         │   │  Card branco     │   │
│                         │   │  rounded-xl      │   │
│   CS Control            │   │  shadow-lg       │   │
│   subtítulo discreto    │   │                  │   │
│                         │   │  [User] input    │   │
│                         │   │  [Lock] input    │   │
│                         │   │  [  Entrar  ]    │   │
│                         │   └──────────────────┘   │
└─────────────────────────┴──────────────────────────┘
```
