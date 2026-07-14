## Objetivo

Adaptar o schema existente para atender ao pedido sem quebrar o app atual: reaproveitar `empresas` e `empresa_usuarios`, criar apenas o que falta e aplicar RLS por vínculo empresa↔usuário, com uma role `admin_interno` que enxerga tudo.

## Situação atual (reaproveitado)

- `empresas` já tem `id`, `nome`, `cnpj`, `status_empresa`, `created_at` — **nada muda**.
- `empresa_usuarios(empresa_id, user_id)` já é o vínculo — servirá como `usuarios_empresa`. Adicionar apenas a coluna `papel`.
- Enum `app_role` já existe (admin, comum, financeiro, …). Adicionar valor `admin_interno`.

## Migração (1 arquivo)

1. **Enum**: `ALTER TYPE app_role ADD VALUE 'admin_interno'`.

2. **`empresa_usuarios`**: adicionar `papel text NOT NULL DEFAULT 'colaborador'` (valores sugeridos: `admin_empresa`, `colaborador`). Sem alterar policies existentes.

3. **Função helper** `SECURITY DEFINER` (evita recursão em RLS):
   ```sql
   public.user_pode_ver_empresa(_empresa uuid) returns boolean
   -- true se has_role(auth.uid(),'admin_interno')
   --      OR EXISTS empresa_usuarios(user_id=auth.uid(), empresa_id=_empresa)
   ```

4. **Novas tabelas** (todas com `id uuid pk`, `empresa_id uuid references empresas(id) on delete cascade`, `created_at timestamptz default now()`):
   - `contratos(valor_mensal numeric, data_inicio date, data_fim date, status text)`
   - `vidas_ativas(nome_beneficiario text, status text, data_inclusao date)`
   - `movimentacao_financeira(tipo text check in ('entrada','saida'), valor numeric, descricao text, data date)`

5. **GRANTs** em cada nova tabela:
   ```
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
   GRANT ALL ON public.<t> TO service_role;
   ```

6. **RLS habilitado** nas 3 novas tabelas + policies:
   - **SELECT**: `USING (public.user_pode_ver_empresa(empresa_id))`
   - **INSERT/UPDATE/DELETE**: restritas a `admin_interno` OU vínculo com a empresa (mesma função). Ajustável depois se quiser regra mais estrita.

7. **Índices**: `(empresa_id)` em cada nova tabela; em `movimentacao_financeira` também `(empresa_id, data)`.

## Observações

- Nenhum código frontend precisa mudar agora — as tabelas novas nascem vazias e isoladas.
- Para marcar alguém como interno: `INSERT INTO user_roles(user_id, role) VALUES (..., 'admin_interno')`.
- Se quiser depois renomear `empresa_usuarios` → `usuarios_empresa` (view), posso adicionar, mas não é necessário e evita refactor amplo.
