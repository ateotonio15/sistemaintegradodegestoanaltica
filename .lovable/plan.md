## Objetivo
Permitir que o perfil **Executiva** troque a executiva responsável de **qualquer empresa** no Painel de Executivas (hoje só Admin consegue salvar de fato; o botão até aparece para Executivo, mas o RLS bloqueia a atualização de empresas que não são dela).

## O que muda

### 1. Banco de dados (RLS)
Hoje a política `Executivo update linked empresas` só permite UPDATE quando `executiva_user_id = auth.uid()`. Vamos substituí-la por uma política que permita ao perfil `executivo` atualizar **qualquer empresa**, mas apenas a coluna `executiva_user_id` (campo de reatribuição). 

Como Postgres RLS não filtra por coluna, a restrição "só esse campo" será garantida via **trigger** `BEFORE UPDATE` que, quando o usuário tem role `executivo` (e não é admin), bloqueia alterações em qualquer outra coluna além de `executiva_user_id` e `updated_at`.

Resumo:
- Substituir policy `Executivo update linked empresas` por `Executivo update empresas` (sem filtro por `executiva_user_id`).
- Criar trigger `trg_guard_empresas_executivo` para impedir que executivo edite outros campos da empresa.

### 2. Frontend
- `src/pages/Executivas.tsx`: nenhuma mudança lógica necessária — `canChangeExecutiva = isAdmin || isExecutivo` já habilita o botão "Alterar Executiva" para o perfil. Após o ajuste de RLS, a gravação passará a funcionar.
- `src/pages/Empresas.tsx`: manter o comportamento atual (executivo só vê/edita as próprias) — sem mudanças.

## Critérios de aceite
- Logado como Executiva, no Painel Executivas, é possível abrir qualquer empresa, escolher outra executiva e salvar com sucesso.
- Executiva continua **sem conseguir** alterar outros campos da empresa (nome, CNPJ, datas, etc.) por outras telas/RPCs.
- Admin segue funcionando normalmente.