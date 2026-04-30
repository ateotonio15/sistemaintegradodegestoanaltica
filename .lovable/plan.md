## Problema

Na sidebar do `AppLayout`, ao clicar em um item de navegação com a sidebar recolhida, ela está expandindo sozinha. A intenção é que apenas o botão de toggle (PanelLeft/PanelLeftClose) controle expandir/recolher.

## Causa

Em `src/components/AppLayout.tsx`:

1. O estado `collapsed` é inicializado a partir de `isMobile`:
   ```ts
   const [collapsed, setCollapsed] = useState(() => isMobile);
   ```
   Como `useIsMobile()` retorna `false` no primeiro render (estado inicial `undefined` → `!!undefined = false`), em desktop a sidebar começa **expandida**, ignorando qualquer preferência anterior do usuário.

2. Existe um `useEffect` que força ressincronização sempre que `isMobile` muda:
   ```ts
   useEffect(() => { setCollapsed(isMobile); }, [isMobile]);
   ```
   Isso sobrescreve a escolha manual do usuário em qualquer recálculo de `isMobile` (por exemplo, ao redimensionar ligeiramente, ao trocar de rota com remount, ou após navegação que dispare reflow). É essa lógica que faz a sidebar "voltar a expandir" — não os `<Link>` em si (eles não têm `onClick`).

3. A preferência não é persistida, então qualquer remount do layout reseta `collapsed` para o default.

## Solução

Tornar o estado `collapsed` controlado exclusivamente pelo botão de toggle, persistido entre navegações, e desacoplado de `isMobile` em desktop.

### Mudanças em `src/components/AppLayout.tsx`

1. **Persistir a preferência em `localStorage`** (chave `sidebar-collapsed`):
   - Inicializar `collapsed` lendo de `localStorage` em desktop.
   - Em mobile, manter o comportamento de iniciar recolhida (overlay).
   - No handler do botão de toggle, gravar o novo valor no `localStorage`.

2. **Remover o `useEffect` que sobrescreve `collapsed` quando `isMobile` muda.**
   - Substituir por uma lógica que só recolhe automaticamente ao **entrar** em mobile (transição desktop → mobile), sem mexer no estado quando voltar para desktop (o usuário recupera sua preferência salva).

3. **Não adicionar nenhum `onClick` nos `<Link>` que altere `collapsed`.** Já não existe — apenas garantir que continue assim. Em mobile, manter o fechamento via clique no overlay (já implementado), o que é esperado.

### Pseudo-código

```ts
const STORAGE_KEY = "sidebar-collapsed";

const [collapsed, setCollapsed] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  if (window.innerWidth < 768) return true; // mobile sempre inicia recolhido
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "true";
});

// Só força recolher quando ENTRA em mobile, não toda vez que isMobile recalcula
const wasMobileRef = useRef(isMobile);
useEffect(() => {
  if (!wasMobileRef.current && isMobile) setCollapsed(true);
  wasMobileRef.current = isMobile;
}, [isMobile]);

const toggleSidebar = () => {
  setCollapsed((prev) => {
    const next = !prev;
    if (!isMobile) localStorage.setItem(STORAGE_KEY, String(next));
    return next;
  });
};
```

E o botão passa a usar `onClick={toggleSidebar}` em vez do `setCollapsed(!collapsed)` inline.

## Arquivos afetados

- `src/components/AppLayout.tsx` (único arquivo)

## Resultado esperado

- Clicar em qualquer item da navegação **não** altera o estado de expansão da sidebar.
- Apenas o botão de toggle (ou o overlay em mobile) muda `collapsed`.
- A preferência do usuário em desktop persiste entre navegações e recargas.
