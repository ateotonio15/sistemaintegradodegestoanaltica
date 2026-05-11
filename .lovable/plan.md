## Objetivo

1. Permitir que o perfil **Cadastro** consiga clicar em **Liberar** nos reajustes solicitados pela Visualização.
2. Garantir que o alerta "X contratos precisam registrar reajuste" do Dashboard apareça **somente para Visualização** — removê-lo de Cadastro (e também de Admin, Executivo, Enfermeira, Financeiro).

## Diagnóstico

**Problema da liberação (item 1)**

Hoje a função `podeLiberar` em `src/pages/Reajustes.tsx` é:

```
podeLiberar = isAdmin || (isComum && empresa.responsavel_user_id === user.id)
```

Ela só reconhece o Cadastro como "responsável" quando o campo `responsavel_user_id` da empresa aponta para o usuário. Porém, na prática, muitos cadastros estão vinculados às empresas via tabela `empresa_usuarios` (vínculo múltiplo), e não pelo campo `responsavel_user_id`. Resultado: o botão **Liberar** simplesmente não aparece para esses cadastros, ou, quando aparece, a RLS/trigger do banco bloqueia a atualização.

A política RLS e o trigger `guard_reajuste_comum` (migração 17) já aceitam ambos os caminhos (`responsavel_user_id` **ou** `empresa_usuarios`). O bug está apenas no front-end.

**Alerta no Dashboard (item 2)**

O componente `AlertaReajustesPendentes` já está gated por `isViewOnly` em `src/pages/Dashboard.tsx` (linha 616). Se ainda aparece para o Cadastro, é porque o usuário em questão pode estar com role mista ou cache antigo. A correção será reforçar o gate explicitamente (`role === "visualizacao"`) e revisar para confirmar que nenhuma outra tela renderiza esse alerta.

> Observação: o alerta amarelo "Novo reajuste registrado aguardando liberação" (`AlertaReajustesParaConfirmar`) **continua** aparecendo para Cadastro e Admin — é justamente o aviso que diz ao Cadastro que existe reajuste a liberar. Nada será alterado nele.

## Mudanças

### 1. `src/pages/Reajustes.tsx`

- Adicionar uma nova query carregando, para o usuário Cadastro logado, todos os `empresa_id` que ele tem em `empresa_usuarios`:
  ```ts
  const { data: minhasEmpresas = [] } = useQuery({
    queryKey: ["minhas-empresas-comum", user?.id],
    enabled: !!user?.id && isComum,
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_usuarios").select("empresa_id").eq("user_id", user!.id);
      return (data || []).map(r => r.empresa_id);
    },
  });
  const minhasEmpresasSet = useMemo(() => new Set(minhasEmpresas), [minhasEmpresas]);
  ```
- Atualizar:
  ```ts
  const podeLiberar = (empresa: any) =>
    isAdmin ||
    (isComum && (empresa.responsavel_user_id === user?.id || minhasEmpresasSet.has(empresa.id)));
  ```
- Nada mais muda no fluxo: o botão **Liberar** já chama `liberarMutation` que grava status, `data_liberacao`, `liberado_por`, `confirmado_por` etc.

### 2. `src/pages/Dashboard.tsx`

- Trocar `{isViewOnly && <AlertaReajustesPendentes />}` por algo equivalente porém explícito, garantindo que NENHUM outro perfil veja:
  ```tsx
  {role === "visualizacao" && <AlertaReajustesPendentes />}
  ```
- Conferir (busca `AlertaReajustesPendentes` no projeto) que o componente não é renderizado em outro lugar acessível ao Cadastro.

## Sem mudanças

- Migrações de banco (RLS e trigger já cobrem o caso).
- Lógica de cálculo de reajuste, retroativo ou histórico.
- Alerta `AlertaReajustesParaConfirmar` (continua para Cadastro e Admin).
- Permissões de criação de reajuste pela Visualização.

## Critérios de aceite

- Logado como Cadastro responsável (via `responsavel_user_id` **ou** via `empresa_usuarios`), o botão **Liberar** aparece nos reajustes pendentes da empresa e a liberação grava status `Reajustado` / `Retroativo Aplicado`, com `liberado_por`, `data_liberacao` e `competência`.
- O cartão "X contratos precisam registrar reajuste" aparece **apenas** no Dashboard do perfil Visualização.
- Visualização continua sem o botão Liberar.
