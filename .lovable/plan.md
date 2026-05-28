## Ocultar "Contratos a Vigência" no modo Movimentação

No `src/pages/Dashboard.tsx`, o componente `<ContratosAVigenciarCard />` (linha 951) é renderizado fora do bloco condicional, aparecendo nos dois modos.

### Alteração
Envolver o card na condição do modo Implantação, para que só apareça nesse modo:

```tsx
{dashboardMode === "implantacao" && <ContratosAVigenciarCard />}
```

Resultado: no modo "Movimentação" do Dashboard do Cadastro, o card "Contratos a Vigência" deixa de aparecer; continua visível no modo "Implantação".