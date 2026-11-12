# Integração SIGA × Portal Financeiro — Descoberta e Desenho

> Etapa: **descoberta (somente leitura)**. Nenhum código, banco, policy, função ou configuração foi alterado. Escopo: `FECHAMENTO MENSAL › Movimentações` (`/movimentacoes`), abas **Empresas** e **Administradoras**.
> Levantamento feito em 12/11/2026 a partir do código-fonte e do catálogo do banco implantado. Onde algo não foi comprovado está marcado **NÃO IDENTIFICADO**; o que não existe, **NÃO EXISTE**.

---

## 1. Stack e infraestrutura

| Item | Situação |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind/shadcn, React Query |
| Backend | Lovable Cloud (Supabase gerenciado: Postgres + PostgREST + Auth + Storage + Edge Functions Deno). Uma única instância serve preview e produção. |
| Região | **NÃO IDENTIFICADO** no código |
| Cliente | `src/integrations/supabase/client.ts` (chave publicável apenas) |

### 1.1 Autenticação e perfis
- Provider: Supabase Auth por **e-mail/senha**, com login por **nome de usuário** resolvido pela edge `resolve-username` / RPC `get_email_by_username`.
- Perfis: tabela `public.user_roles` (enum `app_role`): `admin, comum (UI "Cadastro"), executivo, visualizacao, enfermeira, financeiro, diretora, vendas, administradoras, coordenadora, diretora_saude, executivo_externo, admin_interno, tec_enfermagem`. Checagem via funções `has_role` / `has_any_role` (SECURITY DEFINER) nas policies.
- Contas criadas/excluídas pela edge `create-user` (admin).
- Flags de UI em `src/hooks/useAuth.tsx:346-356`: `isComum` = comum **ou** administradoras; `isViewOnly` = visualizacao **ou** diretora.

### 1.2 "Ver como"
- **Não é impersonação de usuário**; é simulação de **perfil** visual (`src/components/SimularPerfilSwitcher.tsx`, `src/hooks/useAuth.tsx:316-349`).
- Só papel real `admin`. Valor salvo em `localStorage` (`siga:simular-perfil`). Sessão e JWT continuam do admin; RLS continua de admin (o próprio banner avisa).
- **Auditoria: NÃO EXISTE** (nenhum insert/RPC ao iniciar/encerrar simulação). Alterações feitas "vendo como" ficam registradas como do admin.

### 1.3 Edge functions
`admin-corretora-acesso, admin-empresa-acesso, agenda-cirurgica-proxy, analisar-contrato, classificar-atendimento, consultar-cnpj, create-user, criar-empresa-com-acesso, enviar-ficha-bio, enviar-relatorio-email, extrair-anexo1, gerenciar-credencial-central, import-pagadores, orbit-billing-notify, orbit-daily-companies, parse-anexo1, preparar-documento-fechamento, processar-recebimento-central, producao-guias-proxy, public-billing-start, reajustes-operadora-proxy, reajustes-operadora-sync, receber-pdf-central, resolve-username, sincronizar-cirurgias-demandas, sincronizar-situacao-cnpj, sugerir-reclamacao, verificar-agenda-reclamacoes, vidas-operadora-proxy` (+ `_shared`).

Relevantes para Movimentações: **`enviar-relatorio-email`** (SMTP dos relatórios), **`preparar-documento-fechamento`** (documentos do fechamento), `_shared/portal-empresa-relatorios.ts` (jobs no Portal da Empresa), `_shared/envios-empresa.ts` (arquivamento).

Upstreams fixos encontrados: `api-portal-empresa.samel.com.br` (relatórios PDF/XLSX de vidas/mensalidades), `api-agenda-cirurgica.samel.com.br`, `api-iasam.samel.com.br`, `orbit-samel.lovable.app`, `publica.cnpj.ws`, gateway de IA Lovable.

**Webhooks de saída:** apenas `orbit-billing-notify` (Orbit). **Nenhum webhook para o Portal Financeiro — NÃO EXISTE.**
**Webhooks de entrada com token próprio:** `receber-pdf-central` (Central NFS-e), `public-billing-start`.

### 1.4 Cron jobs implantados (`cron.job`)
| Job | Agenda |
|---|---|
| ferias-daily-process | `0 6 * * *` |
| avaliacoes-envios-diario | `0 8 * * *` |
| sincronizar-situacao-cnpj | `* * * * *` |
| processar-recebimentos-central-backstop | `0 * * * *` |
| sincronizar-cirurgias-demandas | `* * * * *` |
| reajustes-operadora-sync-diario | `0 * * * *` |
| verificar-agenda-reclamacoes-diaria | `0 16 * * *` |
| **contratos-suspensos-financeiro** | `15 * * * *` |

Divergência: a migration agenda `ativar-contratos-recem-implantados` (`0 3 * * *`), mas **ele não está na lista de jobs implantados**; a ativação ocorre via RPC `ativar_contratos_pendentes` chamada no "Gerar Movimentação".

### 1.5 Triggers da área (ver Apêndice D)
`movimentacoes`: `trg_guard_mov_comum`, `trg_fin_mark_aguardando_nota`, `trg_ferias_check_retorno`, notificação/envio ao financeiro e outros. `empresas`: `trg_empresa_suspensao_fluxo`, `trg_sync_periodo_movimentacoes`, `trg_sync_empresa_responsavel`, `trg_guard_empresas_executivo`, `trg_sync_tipo_cobranca_from_empresa`, `empresas_set_ultima_alteracao`, etc. `movimentacao_relatorio_envios`: `historico_envios_imutavel` (bloqueia UPDATE/DELETE).

### 1.6 Buckets (todos **privados**)
`anexos-financeiro, anexos-movimentacoes, anexos-implantacao, arquivos-financeiro, atendimentos-anexos, nfse-entrada (10 MB), assinaturas-email (2 MB), relatorios-movimentacoes (15 MB), arquivos-envios (25 MB)`.

### 1.7 Secrets / variáveis (somente nomes)
Servidor: `AGENDA_CIRURGICA_API_KEY, CENTRAL_NFSE_TOKEN, LOVABLE_API_KEY, ORBIT_API_KEY, ORBIT_BILLING_API_KEY, ORBIT_BILLING_WEBHOOK_URL, RESEND_API_KEY, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL`.
Frontend (Vite): `VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_API_BASE_URL, VITE_AGENDA_CIRURGICA_API_KEY` (ver risco R10).

---

## 2. Modelo de dados

Detalhe completo de colunas, constraints, índices, triggers e policies nos **Apêndices A–E** (extraídos do banco implantado).

### 2.1 Tabelas e papel no fluxo
| Tabela | Papel |
|---|---|
| `empresas` (72 col.) | Contrato/cliente. Inclui `codigo_contrato`, `cnpj`, `tipo_contrato` (CHECK `EMPRESARIAL`/`ADMINISTRADORA`), `tipo_movimentacao` (default `Fechada`), `data_corte`, `periodo_movimentacao`, `status_empresa`, `responsavel_user_id`→`profiles`, `responsavel_contrato` (texto legado), `executiva_user_id`, `contrato_suspenso`, `data_suspensao`, `motivo_suspensao`, `status_implantacao`, `primeira_competencia_financeira`, `grupo_contrato` (texto), config. financeira (`tipo_financeiro`, `data_vencimento_fatura`, `data_emissao_fatura`, etc.). |
| `movimentacoes` | Uma linha por empresa × `mes_referencia` (texto `YYYY-MM`) × `periodo` (texto). **UNIQUE (empresa_id, mes_referencia, periodo)**; FK `empresa_id`→`empresas` **ON DELETE CASCADE**. Datas: `data_envio_empresa`, `data_retorno_empresa`, `data_envio_financeiro`; `responsavel_movimentacao` (texto), `tipo_movimentacao`, `dentro_prazo`, `observacoes` (texto acumulado), `cc_email`. **Não há coluna de status nem de versão.** |
| `grupos_financeiros` / `grupos_financeiros_contratos` | "Grupo: Videolar" etc. `nome_grupo` único; `contrato_principal_empresa_id`; vínculo ativo único por empresa (`uniq_empresa_grupo_ativo`). Auditoria em `grupos_financeiros_auditoria`. |
| `contratos` | Tabela simples (valor, datas, status). **Não é usada pela tela Movimentações** (o "contrato" é a própria `empresas`). |
| `empresa_usuarios` | Vínculo usuário↔empresa (responsabilidade). |
| `movimentacao_relatorios` | 1:1 com movimentação (PK `movimentacao_id`): `status`, `destinatarios`, `cc`, `data_envio`, `confirmacao`, `observacoes`, `atualizado_por`, `atualizado_em`. Trigger `validar_movimentacao_relatorio`. |
| `movimentacao_relatorio_envios` | Histórico imutável de envios SMTP (UNIQUE `envio_id, movimentacao_id`). |
| `movimentacao_relatorio_arquivos`, `envios_empresa_arquivos` | Arquivos enviados/arquivados (Repositório de Envios), imutáveis. |
| `anexos_movimentacao` | Metadados dos anexos (bucket `anexos-movimentacoes`); dedup por `repositorio_envio_id`. |
| `movimentacao_fechamento_historico` | Histórico de documentos do fechamento (append-only). |
| `empresa_suspensoes` | Períodos de suspensão (`data_inicio`, `data_fim`, motivo, quem suspendeu/reativou). |
| `movimentacao_suspensos_encaminhamentos` | Contratos suspensos encaminhados ao Financeiro por competência. |
| `financeiro_movimentacoes` | Espelho financeiro por empresa×competência×período (nota, `aguardando_nota_em`, `data_envio_nota`...). Criado por `enviar_movimentacao_ao_financeiro`. |
| `alertas_financeiro` | Alertas tipo `nota`/`vencimento` etc. (`status` CHECK `Pendente`/`Finalizado`, UNIQUE `movimentacao_id, tipo`). |
| `notificacoes` / `notificacoes_lidas` | Sino global. |
| `profiles` | Nome de exibição de usuários. |
| Administradoras | **Não há tabela própria**: são `empresas` com `tipo_contrato='ADMINISTRADORA'` (19 hoje; 286 EMPRESARIAL). |
| Períodos | **Não há tabela**: período é texto em `movimentacoes.periodo`, calculado. |
| "Responsáveis" | `empresas.responsavel_user_id`, `empresa_usuarios`, `movimentacoes.responsavel_movimentacao` (texto), substituição por férias (`ferias_cadastro*`). |

### 2.2 Valores possíveis
- **Tipo de Movimentação** (texto livre, sem CHECK): `Diária` (UI "Diário", 119 empresas), `Fechada` (UI "Período", 186 empresas).
- **Status da movimentação** (calculado no frontend, `src/lib/movimentacao-utils.ts:9-35`), por prioridade:
  1. `Enviado ao financeiro` (tem `data_envio_financeiro`)
  2. `Enviado para empresa` (tem `data_envio_empresa`)
  3. `Fora do prazo` (passou o fim do período, relógio do navegador)
  4. `Aguardando envio`
- **Status Faturamento** (`src/lib/financeiro-utils.ts:19-28`, via RPC `status_faturamento_competencia`): `Nota emitida, Faturado, Aguardando validação, Aguardando faturamento, Enviada, Em faturamento, Aguardando nota, Pendente, Fora do prazo`.
- **Status do relatório** (CHECK no banco): `Não gerado, Gerando, Pronto para envio, Sem destinatário, Enviando, Enviado, Erro no envio, Conferido pela empresa, Divergência informada`. **Confirmação**: `Aguardando, Conferido pela empresa, Divergência informada`.
- **Status de contrato**: `empresas.status_empresa` (`Ativa`/`Inativa`, texto); `contrato_suspenso` (boolean) → selo `Contrato suspenso`; encaminhamento: `encaminhado` (selo `Encaminhado ao Financeiro`), `devolvido_fluxo_normal`, `analise_humana`; aviso `Reativados após o período — precisam de análise`. `status_implantacao` (ex.: `ativo`, `aguardando_primeiro_fechamento`).
- **Alertas financeiros**: `status` `Pendente`/`Finalizado`; `tipo` inclui `nota`, `vencimento` (lista completa **NÃO IDENTIFICADA** — sem CHECK).

### 2.3 Máquina de estados da movimentação
```text
(criada por Gerar/Nova) → Aguardando envio ──(prazo vence)──▶ Fora do prazo
        │                         │
        └─ data_envio_empresa ────┴──▶ Enviado para empresa
                                         │
        data_envio_financeiro (+ ≥1 anexo, validado só no frontend) ──▶ Enviado ao financeiro
```
- Estados **não são persistidos**; derivam das datas. Não há validação de ordem entre datas; `data_retorno_empresa` não participa.
- Quem altera datas: admin (tudo); `comum`/`administradoras` (datas, responsável, observações). Trigger `guard_movimentacoes_comum` impede que comum/administradoras alterem `data_envio_financeiro` já preenchida de empresa que não é sua, impede data futura e preserva `dentro_prazo`.
- Efeitos de `data_envio_financeiro`: trigger `fin_mark_aguardando_nota` marca `financeiro_movimentacoes.aguardando_nota_em`; RPC `enviar_movimentacao_ao_financeiro` cria registro financeiro e alerta (autoriza admin, financeiro, responsável ou vinculado).
- Grupo financeiro: o contrato principal replica datas/observações aos membros **no frontend**.
- Retorno (limpar data financeira): permitido no formulário; efeito sobre alertas depende do banco (**NÃO IDENTIFICADO** integralmente).

### 2.4 Origem de Cód. Contrato e CNPJ
- `empresas.codigo_contrato`: digitado no cadastro ou importado de Excel (colunas `CODIGO_CONTRATO`/`Código do Contrato`) — `src/pages/Empresas.tsx:696-734`.
- `empresas.cnpj`: digitado, opcionalmente preenchido pela consulta pública (`consultar-cnpj`). Sem unicidade nem normalização no banco.
- **Referência a código TASY: NÃO EXISTE** no modelo. Única menção textual: `src/pages/VidasSamel.tsx:169` ("beneficiários por contrato (TASY)"). O `codigo_contrato` é o mesmo número usado nas APIs do Portal da Empresa (relatórios), presumivelmente o contrato TASY — **a confirmar**.

### 2.5 Períodos e "Resumo Geral por Período"
- Períodos fixos: `01-05, 05-10, 10-15, 15-20, 20-25, 25-30` (`src/lib/movimentacao-utils.ts:53-114`). Dia de corte ≤5→01-05; ≤10→05-10; …; restante (inclusive 31)→25-30. `Fechada` usa `periodo_movimentacao`; `Diária` e Administradoras usam `data_corte`. Trigger `sync_periodo_movimentacoes_empresa` ressincroniza ao mudar a configuração.
- Contadores **calculados no frontend** (`src/pages/Movimentacoes.tsx:1196-1223`), sobre a competência inteira (ignoram busca/status/responsável):
  - total = movimentos do período;
  - **concluída(s)** = status `Enviado ao financeiro`;
  - **enviados** = relatório com `data_envio` e status `Enviado`/`Conferido pela empresa`/`Divergência informada`;
  - **pendentes** = total − enviados.
- A RPC `dashboard_movimentacoes` atende os gráficos do Dashboard, não este resumo.

### 2.6 "Sem empresa"
Movimentação cujo join com `empresas` retorna vazio. Como existe FK com CASCADE, hoje há **0** casos no banco; na prática só aparece se a empresa estiver invisível ao usuário por RLS. O filtro "Ver sem empresa" ignora os demais filtros locais.

---

## 3. Inventário de funcionalidades

| Ação | O que faz | Lê / escreve | Efeitos | Quem |
|---|---|---|---|---|
| **Gerar Movimentação** | Cria movimentações faltantes da competência | RPC `ativar_contratos_pendentes`; lê `empresas`, `movimentacoes`; **insert** `movimentacoes` | Nenhum e-mail. Exclui Inativas, suspensas, antes da 1ª competência, sem período. Considera todas as empresas (não só a aba). | admin, comum, administradoras |
| **Preparar Relatórios** | Gera PDF+XLSX no Portal da Empresa e marca prontos | jobs no Portal; **upsert** `movimentacao_relatorios` (`Pronto para envio`/`Sem destinatário`/`Erro no envio`) | Não envia e-mail. Destinatários = `email_empresa` + `email_financeiro_cliente`. Pula suspensos e membros secundários de grupo. | idem |
| **Enviar Relatórios** | Envio em lote por e-mail | edge `enviar-relatorio-email`; RPC `registrar_envio_relatorio_concluido`, `registrar_envio_empresa_arquivos`; grava `movimentacao_relatorio_envios`, `envios_empresa_arquivos`, bucket `arquivos-envios` | **SMTP**; anexos PDF + XLSX (≤15 MB), corpo fixo, assinatura inline; para/cc/bcc. Grupo: só pelo contrato principal com arquivos de todos os membros. Revalida papel, contrato e destinatários no servidor. | idem (papel real) |
| **Mais ações › Atualizar** | Recarrega dados | só leitura | — | todos que veem a tela |
| **Mais ações › Exportar Excel** | `movimentacoes_YYYY-MM.xlsx` da lista filtrada | leitura | arquivo local | idem |
| **Mais ações › Exportar Férias** | `movimentacoes_ferias_YYYY-MM.xlsx` | lê `ferias_*` | arquivo local | idem |
| **Nova Movimentação** | Formulário de criação manual | insert `movimentacoes` | — | admin |
| **Filtros** | Mês (no banco); Buscar (nome/contrato/CNPJ, substring sem normalizar pontuação), Período, Status, Responsável, Somente pendentes (≠ `Enviado ao financeiro`), Ver sem empresa — **todos no frontend** | leitura | — | todos |
| **Contratos suspensos no período** | Lista suspensos encaminhados e reativados | RPC `processar_contratos_suspensos` (ao abrir) + cron horário; lê `movimentacao_suspensos_encaminhamentos` | Encaminha ao Financeiro sem criar movimentação nem `data_envio_financeiro`; reativação tardia sinalizada | admin vê todos; demais só os seus |
| **Ir para Dashboard Geral** | Abre o Dashboard em janela sobre a tela | leitura | — | todos |
| **Editar linha** | Datas, responsável, observação (com carimbo de data/usuário), anexos, importar do Repositório, preparar fechamento, histórico | update `movimentacoes`, `anexos_movimentacao`, storage, `movimentacao_fechamento_historico` | Exige ≥1 anexo para envio ao financeiro (frontend); replica ao grupo; suspensos bloqueados; `executivo_externo` só leitura + importar | admin total; comum/administradoras parcial |
| **Menu ⋮ da linha** | Visualizar relatório; Enviar/Reenviar (individual); registro manual | `movimentacao_relatorios`, edge de envio | SMTP | admin, comum, administradoras |
| **Aba Administradoras** | Componente próprio `DashboardAdministradoras` (filtros, cálculos de vidas, importações) | `empresas` ADMINISTRADORA, `movimentacoes`, anexos, financeiro, `vidas_historico_administradoras` | — | admin, comum/administradoras para ações |
| **Alertas/Sino** | Notificações globais (`notificacoes`, Realtime), avisos cirúrgicos e de saúde | `notificacoes_lidas` | — | por perfil |

Exclusão de movimentação: mutation existe no código, **sem botão visível** atualmente.

---

## 4. Arquivos
| Conteúdo | Bucket | Caminho | Acesso |
|---|---|---|---|
| Anexos da movimentação | `anexos-movimentacoes` (privado) | `{empresaId}/{movId}/{uuid}.{ext}` | RLS de storage por papel; download por **URL assinada de 60 s**. 3.504 anexos, média ≈ 437 KB. |
| Relatórios enviados | `arquivos-envios` (privado, 25 MB) | `envios/{movimentacaoId}/{envioId}/{contrato}-{tipo}-{nome}` | Imutável; leitura para usuários com papel e acesso à movimentação |
| Relatórios de movimentação | `relatorios-movimentacoes` (privado, 15 MB) | escopo por movimentação | idem |
| Assinaturas de e-mail | `assinaturas-email` (privado, 2 MB) | `{userId}.png/jpg` | dono e admin |
| Formatos | PDF (vidas ativas), XLSX (mensalidades), anexos diversos | | **Nenhuma URL pública.** |

---

## 5. Proposta de contrato de integração (NÃO IMPLEMENTADO)

### Arquitetura sugerida
```text
Portal Financeiro (Node/Express, Replit) ──HTTPS──▶ Edge "siga-api" (/v1/...)  ──▶ RPCs SECURITY DEFINER no Postgres
         ▲                                                                              │
         └──── webhooks assinados ◀── Edge "siga-outbox-dispatcher" (cron) ◀── tabela integracao_outbox (gravada por triggers)
```
O Portal **nunca** fala direto com o banco nem recebe `service_role`. Toda escrita passa por RPCs que validam a transição.

### a) API consumida pelo Portal
Base: `https://<siga-functions>/siga-api/v1`. JSON, UTF-8, datas ISO-8601 (`YYYY-MM-DD`), competência `YYYY-MM`.

`GET /v1/movimentacoes?competencia=2026-11&periodo=05-10&status=enviado_financeiro&cnpj=12345678000199&contrato=2194&tipo_contrato=EMPRESARIAL&updated_since=2026-11-12T00:00:00Z&cursor=...&limit=100`
```json
{
  "data": [{
    "id": "uuid", "versao": 7,
    "competencia": "2026-11", "periodo": "05-10", "tipo_movimentacao": "Fechada",
    "status": "enviado_financeiro",
    "empresa": {"id":"uuid","codigo_contrato":"2194","cnpj":"12345678000199","nome":"...","tipo_contrato":"EMPRESARIAL","grupo_financeiro":{"id":"uuid","nome":"Videolar","principal":true}},
    "datas": {"envio_empresa":"2026-11-06","retorno_empresa":null,"envio_financeiro":"2026-11-09"},
    "responsavel": {"user_id":"uuid","nome":"..."},
    "relatorio": {"status":"Enviado","confirmacao":"Aguardando","enviado_em":"2026-11-06T13:10:00Z"},
    "suspensao": null,
    "faturamento": {"status":"Aguardando nota","titulo":null,"lote":null,"nf":null},
    "anexos_count": 3,
    "updated_at": "2026-11-09T14:00:00Z"
  }],
  "next_cursor": "opaque", "has_more": true
}
```
Outros: `GET /v1/movimentacoes/{id}`, `GET /v1/movimentacoes/{id}/anexos` (metadados + URL assinada curta sob demanda), `GET /v1/movimentacoes/{id}/historico`, `GET /v1/empresas?cnpj=&contrato=`, `GET /v1/contratos-suspensos?competencia=`, `GET /v1/resumo-periodos?competencia=` (contadores calculados no **servidor**).
Paginação por cursor (keyset `updated_at,id`), `limit` ≤ 500.
Erros (RFC 7807):
```json
{"type":"https://siga/erros/transicao-invalida","title":"Transição inválida","status":409,"code":"TRANSICAO_INVALIDA","detail":"Movimentação ainda não enviada ao financeiro","correlation_id":"uuid"}
```
Códigos: 400 validação, 401 credencial, 403 escopo, 404, 409 conflito/versão/transição, 422 regra de negócio, 429 limite, 5xx.

### b) Eventos SIGA → Portal (webhooks)
Eventos: `movimentacao.criada`, `movimentacao.atualizada`, `movimentacao.enviada_empresa`, `movimentacao.enviada_financeiro`, `movimentacao.envio_financeiro_revertido`, `relatorio.preparado`, `relatorio.enviado`, `relatorio.confirmado`, `anexo.adicionado`, `anexo.removido`, `contrato.suspenso`, `contrato.reativado`, `contrato.encaminhado_financeiro`, `empresa.atualizada` (campos de correlação), `grupo_financeiro.alterado`.
```json
{"event_id":"uuid-v7","type":"movimentacao.enviada_financeiro","occurred_at":"2026-11-09T14:00:00Z","origem":"SIGA","ator":{"user_id":"uuid","nome":"..."},
 "data":{"movimentacao_id":"uuid","versao":7,"competencia":"2026-11","periodo":"05-10","codigo_contrato":"2194","cnpj":"12345678000199"},
 "changes":{"data_envio_financeiro":{"de":null,"para":"2026-11-09"}}}
```
Cabeçalhos: `X-Siga-Event-Id`, `X-Siga-Timestamp` (epoch s), `X-Siga-Signature: v1=hex(HMAC_SHA256(secret, timestamp + "." + body))`. Portal rejeita |agora − timestamp| > 300 s e `event_id` repetido (idempotência).
Entrega: tabela outbox gravada na **mesma transação** da mudança (trigger), dispatcher por cron a cada minuto; retry exponencial (1m, 5m, 15m, 1h, 6h, 24h) com jitter; após N falhas → `dead_letter` com reenvio manual; ordenação por `movimentacao_id`+`versao` (Portal descarta versão menor que a já aplicada). Para eventos financeiros vindos do Portal, **não reemitir** de volta (evitar eco), ou emitir com `origem: "PORTAL"` para o Portal ignorar.

### c) Endpoints para o Portal ATUALIZAR
- `PATCH /v1/movimentacoes/{id}/faturamento` — `{ "versao":7, "status":"Faturado", "titulo":"...", "lote":"...", "nf":{"numero":"17790","emitida_em":"2026-11-10"}, "vencimento":"2026-11-20" }`
- `POST /v1/movimentacoes/{id}/titulos` — registro de título gerado no TASY.
- `POST /v1/movimentacoes/{id}/devolucao` — devolver ao SIGA com motivo (reverte envio ao financeiro).
- `PUT /v1/movimentacoes/{id}/envio-financeiro` — **somente se o negócio decidir** que o Portal pode registrar a data (ver perguntas).
Todas: header `Idempotency-Key`, `If-Match`/campo `versao`, validação de transição em RPC no servidor (ex.: não aceitar `Faturado` sem `envio_financeiro`; não aceitar em contrato suspenso), resposta com o novo estado e `versao`.
Hoje os dados financeiros ficam em `financeiro_movimentacoes`/`anexos_financeiro`; o desenho deve decidir se o Portal escreve lá (preferível, mantendo a aba Financeiro) ou em tabela nova.

### d) Autenticação servidor-a-servidor
- Credencial própria do Portal (client_id + segredo forte armazenado como secret do SIGA e no Replit), trocada por token curto (JWT assinado pelo SIGA, 15 min) **ou** HMAC por requisição; mTLS/IP allowlist do Replit se possível.
- Escopos: `movimentacoes:read`, `anexos:read`, `faturamento:write`, `eventos:receive`. Nada de `service_role` fora do backend SIGA; nada no frontend do Portal.
- Rotação de segredo com dois segredos válidos em sobreposição; rate limit por credencial; log de cada chamada.

### e) Correlação SIGA × TASY
- Chave natural proposta: **`codigo_contrato` + `competencia` (`YYYY-MM`) + `periodo`**, com `cnpj` (14 dígitos normalizados) como verificação. A SIGA mantém `movimentacao.id` (UUID) como chave técnica; o Portal guarda o UUID.
- Problemas atuais: `codigo_contrato` e `cnpj` não são únicos nem obrigatórios; vários contratos podem ter o mesmo CNPJ/nome (ex.: PLURAL) e grupos financeiros faturam por pagador (`financeiro_pagadores`).
- Registros sem vínculo: endpoint/fila `pendencias_vinculo` (status `sem_contrato_tasy`, `cnpj_divergente`, `ambiguo`) com resolução humana; nunca casar por nome quando o CNPJ diverge (regra já existente no SIGA).

### f) Auditoria
Tabela append-only `integracao_auditoria`: `id, entidade, entidade_id, origem (SIGA|PORTAL|SISTEMA), ator_user_id/cliente_id, ator_nome, acao, antes jsonb, depois jsonb, versao, correlation_id, ocorrido_em`. Gravada por trigger em `movimentacoes`, `movimentacao_relatorios`, campos de correlação de `empresas` e tabelas financeiras. Imutável (bloqueio de UPDATE/DELETE como em `movimentacao_relatorio_envios`). Registrar também início/fim de "Ver como".

### g) Concorrência
- Adicionar `versao integer` incrementada por trigger em cada UPDATE de `movimentacoes` (e na tabela financeira). Escritas do Portal exigem `versao` esperada → 409 `VERSAO_DESATUALIZADA` com estado atual.
- Na tela SIGA, o salvamento também deve enviar a versão lida (hoje faz update cego).
- Divisão de propriedade por campo: SIGA é dono das datas operacionais/relatórios; Portal é dono de faturamento/título/NF. Conflitos só ocorrem em campos compartilhados (ex.: devolução), resolvidos pela máquina de estados no servidor.

---

## 6. Riscos e lacunas
| # | Risco | Impacto na integração |
|---|---|---|
| R1 | **Status da movimentação não é persistido** — calculado no navegador (relógio local) | Portal não tem fonte de verdade; precisa de cálculo no servidor (view/função) antes de expor. |
| R2 | Regra "≥1 anexo antes de enviar ao financeiro" só no frontend | Uma API poderia contornar; mover para trigger/RPC. |
| R3 | Replicação de datas aos membros do grupo financeiro e sincronização de datas de anexos feitas no frontend | Mudanças via API não replicariam; mover para o servidor. |
| R4 | Resumo por período e filtros calculados no client | Repetir no servidor para o endpoint de resumo. |
| R5 | Policies amplas: vários perfis (`comum`, `administradoras`, `financeiro`) inserem/atualizam qualquer movimentação (policies `Comum user update movimentacoes`, etc.); proteção parcial só pelo trigger `guard_movimentacoes_comum` | Escopo de escrita difícil de garantir; API deve usar RPCs próprias. |
| R6 | FK `movimentacoes.empresa_id` com **ON DELETE CASCADE** | Excluir empresa apaga histórico já integrado; tratar antes. |
| R7 | `codigo_contrato`/`cnpj` sem unicidade, obrigatoriedade ou normalização | Correlação com TASY ambígua. |
| R8 | `mes_referencia`/`periodo`/`tipo_movimentacao` como texto sem CHECK | Valores inválidos possíveis. |
| R9 | Sem coluna de versão; updates cegos | Perda de atualização concorrente. |
| R10 | `VITE_AGENDA_CIRURGICA_API_KEY` referenciada no frontend (`src/lib/agendaCirurgicaApi.ts`, `vidasSamelApi.ts`) | Chave potencialmente exposta no navegador; fora do escopo mas relevante para o padrão de segredos. |
| R11 | Sem auditoria de "Ver como"; sem auditoria genérica de `movimentacoes` (só `observacoes` em texto acumulado) | Não atende requisito f) hoje. |
| R12 | Cron `ativar-contratos-recem-implantados` definido na migration mas ausente nos jobs implantados | Ativação depende de alguém clicar "Gerar Movimentação". |
| R13 | Corpos completos de `processar_contratos_suspensos`, `registrar_envio_relatorio_concluido`, `handle_envio_financeiro` e efeitos em `alertas_financeiro` ao limpar a data **NÃO IDENTIFICADOS** integralmente | Revisar antes de definir eventos de reversão. |
| R14 | "Gerar Movimentação" roda no client, inserindo linha a linha | Lento e não atômico; idealmente RPC no servidor (e emissor de `movimentacao.criada`). |
| R15 | Não existe nenhum mecanismo de webhook/outbox hoje | Precisa ser criado do zero. |
| R16 | `contratos` (tabela) não usada; "contrato" = `empresas` | Evitar confusão no contrato da API. |

---

## 7. Perguntas de negócio (antes de implementar)
1. Quem é a **fonte da verdade** de cada campo? Ex.: a data de envio ao financeiro pode ser gravada pelo Portal ou só pelo SIGA?
2. O Portal Financeiro substitui a aba **Financeiro** do SIGA ou ambas convivem? Se convivem, qual prevalece em conflito?
3. O `codigo_contrato` do SIGA é **exatamente** o número do contrato no TASY? Administradoras usam o mesmo código?
4. A unidade faturada é o **contrato**, o **pagador** ou o **grupo financeiro** (ex.: Videolar)? Como o Portal deve receber grupos?
5. Quais status financeiros o Portal devolve (lista oficial) e qual o mapeamento para os 9 status atuais do SIGA?
6. O Portal pode **devolver** uma movimentação ao SIGA (ex.: divergência)? O que acontece com relatórios e anexos?
7. Contratos **suspensos** encaminhados ao Financeiro devem gerar título no TASY? E reativações tardias?
8. Quais **anexos** o Portal precisa (todos, só PDF/XLSX de vidas, notas)? Download sob demanda ou cópia?
9. Prazo aceitável de sincronização (tempo real, minutos, lote noturno)?
10. Precisa de **carga inicial** de histórico? Desde qual competência?
11. Movimentações "sem empresa"/sem vínculo TASY: quem resolve e em quanto tempo?
12. "Fora do prazo" deve ser calculado em qual fuso/regra oficial (Manaus) e congelado em algum momento?
13. Quem no SIGA deve ser notificado quando o Portal faturar/gerar título (sino, e-mail)?
14. O Portal precisa de dados de **Administradoras** com o mesmo contrato ou de um fluxo separado?
15. Quais perfis do Portal podem alterar dados do SIGA, e isso precisa ser identificado por usuário (nome) na auditoria?
16. Há exigência de LGPD/retenção para trafegar dados de beneficiários (relatórios de vidas) ao Portal?

---
## Apêndice A — Colunas (information_schema)


### alertas_financeiro

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| movimentacao_id | uuid | NO | `<nil>` |
| empresa_id | uuid | NO | `<nil>` |
| empresa_nome | text | NO | `<nil>` |
| enviado_por_user_id | uuid | YES | `<nil>` |
| enviado_por_nome | text | YES | `<nil>` |
| data_envio | date | NO | `CURRENT_DATE` |
| status | text | NO | `'Pendente'::text` |
| finalizado_em | timestamp with time zone | YES | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| tipo | text | NO | `'nota'::text` |

### anexos_movimentacao

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| movimentacao_id | uuid | NO | `<nil>` |
| empresa_id | uuid | NO | `<nil>` |
| nome_arquivo | text | NO | `<nil>` |
| storage_path | text | NO | `<nil>` |
| mime_type | text | YES | `<nil>` |
| tamanho_bytes | bigint | YES | `<nil>` |
| uploaded_by | uuid | YES | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |
| origem_importacao | text | YES | `<nil>` |
| repositorio_envio_id | uuid | YES | `<nil>` |

### contratos

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| empresa_id | uuid | NO | `<nil>` |
| valor_mensal | numeric | YES | `<nil>` |
| data_inicio | date | YES | `<nil>` |
| data_fim | date | YES | `<nil>` |
| status | text | NO | `'ativo'::text` |
| created_at | timestamp with time zone | NO | `now()` |

### empresa_suspensoes

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| empresa_id | uuid | NO | `<nil>` |
| data_inicio | date | NO | `<nil>` |
| data_fim | date | YES | `<nil>` |
| motivo | text | NO | `<nil>` |
| observacao | text | YES | `<nil>` |
| suspenso_por | uuid | YES | `<nil>` |
| reativado_por | uuid | YES | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| observacao_reativacao | text | YES | `<nil>` |
| reativado_em | timestamp with time zone | YES | `<nil>` |

### empresa_usuarios

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| empresa_id | uuid | NO | `<nil>` |
| user_id | uuid | NO | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |
| papel | text | NO | `'colaborador'::text` |

### empresas

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| nome | text | NO | `<nil>` |
| cnpj | text | YES | `<nil>` |
| responsavel_contrato | text | YES | `<nil>` |
| operadora_plano | text | YES | `<nil>` |
| data_corte | integer | YES | `<nil>` |
| dia_movimentacao | integer | YES | `<nil>` |
| observacoes | text | YES | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| codigo_contrato | text | YES | `<nil>` |
| tipo_movimentacao | text | YES | `'Fechada'::text` |
| periodo_movimentacao | text | YES | `<nil>` |
| email_empresa | text | YES | `<nil>` |
| status_empresa | text | YES | `'Ativa'::text` |
| data_implantacao | date | YES | `<nil>` |
| responsavel_user_id | uuid | YES | `<nil>` |
| data_rescisao | date | YES | `<nil>` |
| prazo | text | YES | `<nil>` |
| grupo_contrato | text | YES | `<nil>` |
| telefone_empresa | text | YES | `<nil>` |
| contato_empresa | text | YES | `<nil>` |
| executiva_user_id | uuid | YES | `<nil>` |
| data_vencimento_fatura | integer | YES | `<nil>` |
| data_emissao_fatura | integer | YES | `<nil>` |
| endereco | text | YES | `<nil>` |
| contrato_faixa_etaria | boolean | NO | `false` |
| contrato_suspenso | boolean | NO | `false` |
| data_suspensao | date | YES | `<nil>` |
| motivo_suspensao | text | YES | `<nil>` |
| tipo_financeiro | text | YES | `<nil>` |
| vidas | integer | NO | `0` |
| tipo_contrato | text | NO | `'EMPRESARIAL'::text` |
| pagamento_via_deposito | boolean | NO | `false` |
| nao_faturado_financeiro | boolean | NO | `false` |
| exige_po_pc | boolean | NO | `false` |
| email_financeiro_cliente | text | YES | `<nil>` |
| observacao_padrao_financeiro | text | YES | `<nil>` |
| regra_prorrogacao | text | YES | `<nil>` |
| exige_relatorio_antes_nota | boolean | NO | `false` |
| config_financeira_confirmada | boolean | NO | `false` |
| envio_boleto_com_nota | boolean | NO | `false` |
| tem_coparticipacao | boolean | NO | `false` |
| valor_enfermaria_centavos | bigint | YES | `<nil>` |
| valor_apartamento_centavos | bigint | YES | `<nil>` |
| faixas_etarias | jsonb | YES | `<nil>` |
| periodo_especifico_cobranca | boolean | NO | `false` |
| periodo_cobranca_inicio | date | YES | `<nil>` |
| status_implantacao | text | NO | `'ativo'::text` |
| primeira_competencia_financeira | text | YES | `<nil>` |
| primeiro_fechamento_em | timestamp with time zone | YES | `<nil>` |
| primeiro_processamento_financeiro_em | timestamp with time zone | YES | `<nil>` |
| ultima_alteracao_user_id | uuid | YES | `<nil>` |
| ultima_alteracao_nome | text | YES | `<nil>` |
| ultima_alteracao_em | timestamp with time zone | YES | `<nil>` |
| prioridade_maxima_id | uuid | YES | `<nil>` |
| contrato_via_portal | boolean | NO | `false` |
| portal_ativo | boolean | NO | `true` |
| portal_secoes | jsonb | NO | `'{"chat": true, "vidas": true, "contrato": true, "movimentacoes": true}'::jsonb` |
| vencimento_competencia | text | NO | `'atual'::text` |
| sem_executiva_vinculada | boolean | NO | `false` |
| nao_reajustado | boolean | NO | `false` |
| aguarda_faturamento_excel | boolean | NO | `false` |
| enderecos | jsonb | YES | `<nil>` |
| razao_social | text | YES | `<nil>` |
| nome_fantasia | text | YES | `<nil>` |
| isento_reajuste | boolean | NO | `false` |
| plano | text | YES | `<nil>` |
| produto_enfermaria_codigo | integer | YES | `<nil>` |
| produto_apartamento_codigo | integer | YES | `<nil>` |
| produto_nao_definido_codigo | integer | YES | `<nil>` |
| classificacao | text | YES | `<nil>` |

### envios_empresa_arquivos

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| envio_id | uuid | NO | `<nil>` |
| movimentacao_id | uuid | NO | `<nil>` |
| empresa_id | uuid | NO | `<nil>` |
| contrato | text | NO | `<nil>` |
| competencia | text | NO | `<nil>` |
| periodo | text | YES | `<nil>` |
| nome_arquivo | text | NO | `<nil>` |
| bucket | text | NO | `'arquivos-envios'::text` |
| storage_path | text | NO | `<nil>` |
| mime_type | text | YES | `<nil>` |
| tamanho_bytes | bigint | YES | `<nil>` |
| tipo_relatorio | text | NO | `<nil>` |
| enviado_por | uuid | NO | `<nil>` |
| enviado_nome | text | YES | `<nil>` |
| enviado_em | timestamp with time zone | NO | `clock_timestamp()` |
| origem | text | NO | `'Envio automático por e-mail'::text` |
| versao | integer | NO | `1` |
| status | text | NO | `'Enviado'::text` |

### financeiro_movimentacoes

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| empresa_id | uuid | NO | `<nil>` |
| mes_referencia | text | NO | `<nil>` |
| periodo | text | NO | `<nil>` |
| tipo_cobranca | text | YES | `<nil>` |
| data_envio_nota | date | YES | `<nil>` |
| dentro_prazo | boolean | NO | `true` |
| cobranca_registrada | boolean | NO | `false` |
| responsavel | text | YES | `<nil>` |
| observacoes | text | YES | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| data_vencimento | date | YES | `<nil>` |
| enviado_por_user_id | uuid | YES | `<nil>` |
| dia_emissao | smallint | YES | `<nil>` |
| aguardando_nota_em | timestamp with time zone | YES | `<nil>` |
| tipo_analise | text | NO | `'normal'::text` |
| possui_prorrogacao | boolean | NO | `false` |
| data_prorrogacao | date | YES | `<nil>` |
| motivo_prorrogacao | text | YES | `<nil>` |
| observacao_prorrogacao | text | YES | `<nil>` |
| boleto_dda | boolean | NO | `false` |
| boleto_confirmado_por | uuid | YES | `<nil>` |
| boleto_confirmado_em | timestamp with time zone | YES | `<nil>` |
| faturamento_iniciado_por | uuid | YES | `<nil>` |
| faturamento_iniciado_por_nome | text | YES | `<nil>` |
| faturamento_iniciado_em | timestamp with time zone | YES | `<nil>` |
| tipo_lancamento | text | NO | `'normal'::text` |

### financeiro_pagadores

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| empresa_id | uuid | NO | `<nil>` |
| nome_pagador | text | NO | `<nil>` |
| ativo | boolean | NO | `true` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| cnpj | text | YES | `<nil>` |
| inativo_a_partir_de | text | YES | `<nil>` |

### grupos_financeiros

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| nome_grupo | text | NO | `<nil>` |
| vencimento_compartilhado | boolean | NO | `false` |
| dia_vencimento | smallint | YES | `<nil>` |
| forma_pagamento_compartilhada | boolean | NO | `false` |
| forma_pagamento | text | YES | `<nil>` |
| observacao | text | YES | `<nil>` |
| status | text | NO | `'Ativo'::text` |
| criado_por_id | uuid | YES | `<nil>` |
| criado_por_nome | text | YES | `<nil>` |
| atualizado_por_id | uuid | YES | `<nil>` |
| atualizado_por_nome | text | YES | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| contrato_principal_empresa_id | uuid | YES | `<nil>` |

### grupos_financeiros_contratos

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| grupo_id | uuid | NO | `<nil>` |
| empresa_id | uuid | NO | `<nil>` |
| codigo_contrato | text | YES | `<nil>` |
| nome_empresa | text | YES | `<nil>` |
| cnpj | text | YES | `<nil>` |
| ativo | boolean | NO | `true` |
| adicionado_por_id | uuid | YES | `<nil>` |
| adicionado_por_nome | text | YES | `<nil>` |
| adicionado_em | timestamp with time zone | NO | `now()` |
| removido_por_id | uuid | YES | `<nil>` |
| removido_por_nome | text | YES | `<nil>` |
| removido_em | timestamp with time zone | YES | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |

### movimentacao_fechamento_historico

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| movimentacao_id | uuid | NO | `<nil>` |
| evento | text | NO | `<nil>` |
| anexo_id | uuid | YES | `<nil>` |
| nome_arquivo | text | YES | `<nil>` |
| tipo_relatorio | text | YES | `<nil>` |
| contrato | text | NO | `''::text` |
| competencia | text | NO | `''::text` |
| periodo | text | YES | `<nil>` |
| origem | text | NO | `'API / integração'::text` |
| criado_em | timestamp with time zone | NO | `now()` |
| usuario_id | uuid | NO | `auth.uid()` |
| usuario_nome | text | NO | `''::text` |
| pendencias | ARRAY | NO | `'{}'::text[]` |

### movimentacao_relatorio_arquivos

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| movimentacao_id | uuid | NO | `<nil>` |
| nome_arquivo | text | NO | `<nil>` |
| storage_path | text | NO | `<nil>` |
| mime_type | text | YES | `<nil>` |
| tamanho_bytes | bigint | NO | `<nil>` |
| uploaded_by | uuid | NO | `auth.uid()` |
| created_at | timestamp with time zone | NO | `now()` |

### movimentacao_relatorio_envios

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| envio_id | uuid | NO | `<nil>` |
| movimentacao_id | uuid | NO | `<nil>` |
| principal_movimentacao_id | uuid | NO | `<nil>` |
| enviado_em | timestamp with time zone | NO | `now()` |
| enviado_por | uuid | NO | `<nil>` |
| nome_remetente | text | YES | `<nil>` |

### movimentacao_relatorios

| coluna | tipo | nullable | default |
|---|---|---|---|
| movimentacao_id | uuid | NO | `<nil>` |
| status | text | NO | `'Não gerado'::text` |
| destinatarios | text | NO | `''::text` |
| data_envio | date | YES | `<nil>` |
| confirmacao | text | NO | `'Aguardando'::text` |
| observacoes | text | NO | `''::text` |
| atualizado_por | uuid | NO | `auth.uid()` |
| atualizado_em | timestamp with time zone | NO | `now()` |
| cc | text | NO | `''::text` |

### movimentacao_suspensos_encaminhamentos

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| empresa_id | uuid | NO | `<nil>` |
| empresa_nome | text | NO | `<nil>` |
| codigo_contrato | text | YES | `<nil>` |
| mes_referencia | text | NO | `<nil>` |
| periodo | text | NO | `<nil>` |
| movimentacao_id | uuid | YES | `<nil>` |
| financeiro_movimentacao_id | uuid | YES | `<nil>` |
| situacao | text | NO | `'contrato suspenso'::text` |
| status | text | NO | `'encaminhado'::text` |
| encaminhado_em | timestamp with time zone | NO | `now()` |
| encaminhado_por | uuid | YES | `<nil>` |
| encaminhado_por_nome | text | NO | `'Processo automático'::text` |
| reativado_em | timestamp with time zone | YES | `<nil>` |
| resolvido_em | timestamp with time zone | YES | `<nil>` |
| observacao | text | YES | `<nil>` |

### movimentacoes

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| empresa_id | uuid | NO | `<nil>` |
| mes_referencia | text | NO | `<nil>` |
| periodo | text | NO | `<nil>` |
| data_envio_empresa | date | YES | `<nil>` |
| data_retorno_empresa | date | YES | `<nil>` |
| data_envio_financeiro | date | YES | `<nil>` |
| responsavel_movimentacao | text | YES | `<nil>` |
| observacoes | text | YES | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |
| updated_at | timestamp with time zone | NO | `now()` |
| tipo_movimentacao | text | YES | `<nil>` |
| dentro_prazo | boolean | YES | `true` |
| cc_email | text | YES | `<nil>` |

### notificacoes

| coluna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| tipo | text | NO | `<nil>` |
| empresa_id | uuid | NO | `<nil>` |
| nome_empresa | text | NO | `<nil>` |
| codigo_contrato | text | YES | `<nil>` |
| responsavel_contrato | text | YES | `<nil>` |
| data_implantacao | text | YES | `<nil>` |
| created_at | timestamp with time zone | NO | `now()` |

## Apêndice B — Constraints (PK/FK/UNIQUE/CHECK)

- **empresas** `empresas_tipo_financeiro_check`: `CHECK (((tipo_financeiro IS NULL) OR (tipo_financeiro = ANY (ARRAY['NÃO-PRORATA'::text, 'INCLUSÃO'::text, 'INCLUSÃO/EXCLUSÃO'::text, 'INCLUSÃO/EXCLUSÃO/COPAR'::text, 'TAXA ADESÃO'::text, '30 dias'::text]))))`
- **empresas** `empresas_produto_nao_definido_codigo_fkey`: `FOREIGN KEY (produto_nao_definido_codigo) REFERENCES produtos_planos(codigo_produto)`
- **empresas** `empresas_produto_apartamento_codigo_fkey`: `FOREIGN KEY (produto_apartamento_codigo) REFERENCES produtos_planos(codigo_produto)`
- **empresas** `empresas_produto_enfermaria_codigo_fkey`: `FOREIGN KEY (produto_enfermaria_codigo) REFERENCES produtos_planos(codigo_produto)`
- **empresas** `empresas_prioridade_maxima_id_fkey`: `FOREIGN KEY (prioridade_maxima_id) REFERENCES empresa_prioridade_maxima(id)`
- **empresas** `empresas_vencimento_competencia_check`: `CHECK ((vencimento_competencia = ANY (ARRAY['anterior'::text, 'atual'::text, 'posterior'::text])))`
- **empresas** `empresas_responsavel_user_id_fkey`: `FOREIGN KEY (responsavel_user_id) REFERENCES profiles(user_id)`
- **empresas** `empresas_pkey`: `PRIMARY KEY (id)`
- **empresas** `empresas_classificacao_opcoes`: `CHECK (((classificacao IS NULL) OR (classificacao = ANY (ARRAY['Empresarial'::text, 'Empresarial Copart. - Total'::text, 'Empresarial Copart. - Parcial'::text]))))`
- **empresas** `empresas_tipo_contrato_check`: `CHECK ((tipo_contrato = ANY (ARRAY['EMPRESARIAL'::text, 'ADMINISTRADORA'::text])))`
- **movimentacoes** `movimentacoes_empresa_id_fkey`: `FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE`
- **movimentacoes** `movimentacoes_empresa_mes_periodo_uniq`: `UNIQUE (empresa_id, mes_referencia, periodo)`
- **movimentacoes** `movimentacoes_pkey`: `PRIMARY KEY (id)`
- **empresa_usuarios** `empresa_usuarios_empresa_user_unique`: `UNIQUE (empresa_id, user_id)`
- **empresa_usuarios** `empresa_usuarios_empresa_id_user_id_key`: `UNIQUE (empresa_id, user_id)`
- **empresa_usuarios** `empresa_usuarios_pkey`: `PRIMARY KEY (id)`
- **empresa_usuarios** `empresa_usuarios_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE`
- **empresa_usuarios** `empresa_usuarios_empresa_id_fkey`: `FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE`
- **empresa_suspensoes** `empresa_suspensoes_empresa_id_fkey`: `FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE`
- **empresa_suspensoes** `empresa_suspensoes_pkey`: `PRIMARY KEY (id)`
- **anexos_movimentacao** `anexos_movimentacao_pkey`: `PRIMARY KEY (id)`
- **alertas_financeiro** `alertas_financeiro_status_check`: `CHECK ((status = ANY (ARRAY['Pendente'::text, 'Finalizado'::text])))`
- **alertas_financeiro** `alertas_financeiro_pkey`: `PRIMARY KEY (id)`
- **grupos_financeiros** `grupos_financeiros_pkey`: `PRIMARY KEY (id)`
- **grupos_financeiros** `grupos_financeiros_dia_vencimento_check`: `CHECK (((dia_vencimento IS NULL) OR ((dia_vencimento >= 1) AND (dia_vencimento <= 31))))`
- **grupos_financeiros** `grupos_financeiros_forma_pagamento_check`: `CHECK (((forma_pagamento IS NULL) OR (forma_pagamento = ANY (ARRAY['DDA'::text, 'Depósito'::text]))))`
- **grupos_financeiros** `grupos_financeiros_status_check`: `CHECK ((status = ANY (ARRAY['Ativo'::text, 'Inativo'::text])))`
- **grupos_financeiros** `grupos_financeiros_nome_grupo_key`: `UNIQUE (nome_grupo)`
- **grupos_financeiros** `grupos_financeiros_contrato_principal_empresa_id_fkey`: `FOREIGN KEY (contrato_principal_empresa_id) REFERENCES empresas(id) ON DELETE SET NULL`
- **grupos_financeiros_contratos** `grupos_financeiros_contratos_pkey`: `PRIMARY KEY (id)`
- **grupos_financeiros_contratos** `grupos_financeiros_contratos_grupo_id_fkey`: `FOREIGN KEY (grupo_id) REFERENCES grupos_financeiros(id) ON DELETE CASCADE`
- **grupos_financeiros_contratos** `grupos_financeiros_contratos_empresa_id_fkey`: `FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE`
- **movimentacao_relatorios** `movimentacao_relatorios_movimentacao_id_fkey`: `FOREIGN KEY (movimentacao_id) REFERENCES movimentacoes(id) ON DELETE CASCADE`
- **movimentacao_relatorios** `movimentacao_relatorios_status_check`: `CHECK ((status = ANY (ARRAY['Não gerado'::text, 'Gerando'::text, 'Pronto para envio'::text, 'Sem destinatário'::text, 'Enviando'::text, 'Enviado'::text, 'Erro no envio'::text, 'Conferido pela empresa'::text, 'Divergência informada'::text])))`
- **movimentacao_relatorios** `movimentacao_relatorios_confirmacao_check`: `CHECK ((confirmacao = ANY (ARRAY['Aguardando'::text, 'Conferido pela empresa'::text, 'Divergência informada'::text])))`
- **movimentacao_relatorios** `movimentacao_relatorios_pkey`: `PRIMARY KEY (movimentacao_id)`
- **movimentacao_relatorio_envios** `movimentacao_relatorio_envios_pkey`: `PRIMARY KEY (id)`
- **movimentacao_relatorio_envios** `movimentacao_relatorio_envios_envio_id_movimentacao_id_key`: `UNIQUE (envio_id, movimentacao_id)`
- **movimentacao_fechamento_historico** `movimentacao_fechamento_historico_anexo_id_key`: `UNIQUE (anexo_id)`
- **movimentacao_fechamento_historico** `movimentacao_fechamento_historico_pkey`: `PRIMARY KEY (id)`
- **movimentacao_suspensos_encaminhamentos** `movimentacao_suspensos_encaminhamentos_status_check`: `CHECK ((status = ANY (ARRAY['encaminhado'::text, 'devolvido_fluxo_normal'::text, 'analise_humana'::text])))`
- **movimentacao_suspensos_encaminhamentos** `movimentacao_suspensos_encaminhamentos_empresa_id_fkey`: `FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE`
- **movimentacao_suspensos_encaminhamentos** `movimentacao_suspensos_encaminhamentos_pkey`: `PRIMARY KEY (id)`
- **movimentacao_suspensos_encaminhamentos** `movimentacao_suspensos_encaminham_empresa_id_mes_referencia_key`: `UNIQUE (empresa_id, mes_referencia)`

## Apêndice C — Índices

- **alertas_financeiro**: `CREATE UNIQUE INDEX alertas_financeiro_pkey ON public.alertas_financeiro USING btree (id)`
- **alertas_financeiro**: `CREATE INDEX idx_alertas_fin_status ON public.alertas_financeiro USING btree (status)`
- **alertas_financeiro**: `CREATE INDEX idx_alertas_fin_empresa ON public.alertas_financeiro USING btree (empresa_id)`
- **alertas_financeiro**: `CREATE UNIQUE INDEX alertas_financeiro_mov_tipo_uniq ON public.alertas_financeiro USING btree (movimentacao_id, tipo)`
- **anexos_movimentacao**: `CREATE UNIQUE INDEX anexos_movimentacao_pkey ON public.anexos_movimentacao USING btree (id)`
- **anexos_movimentacao**: `CREATE INDEX idx_anexos_mov_mov_id ON public.anexos_movimentacao USING btree (movimentacao_id)`
- **anexos_movimentacao**: `CREATE INDEX idx_anexos_mov_empresa_id ON public.anexos_movimentacao USING btree (empresa_id)`
- **anexos_movimentacao**: `CREATE UNIQUE INDEX anexos_repositorio_unico ON public.anexos_movimentacao USING btree (movimentacao_id, repositorio_envio_id) WHERE (repositorio_envio_id IS NOT NULL)`
- **empresa_suspensoes**: `CREATE UNIQUE INDEX empresa_suspensoes_pkey ON public.empresa_suspensoes USING btree (id)`
- **empresa_suspensoes**: `CREATE INDEX idx_empresa_suspensoes_empresa ON public.empresa_suspensoes USING btree (empresa_id)`
- **empresa_suspensoes**: `CREATE INDEX idx_empresa_suspensoes_aberta ON public.empresa_suspensoes USING btree (empresa_id) WHERE (data_fim IS NULL)`
- **empresas**: `CREATE UNIQUE INDEX empresas_pkey ON public.empresas USING btree (id)`
- **empresas**: `CREATE INDEX idx_empresas_prioridade ON public.empresas USING btree (prioridade_maxima_id) WHERE (prioridade_maxima_id IS NOT NULL)`
- **empresas**: `CREATE INDEX idx_empresas_status_implantacao ON public.empresas USING btree (status_implantacao) WHERE (status_implantacao = 'aguardando_primeiro_fechamento'::text)`
- **grupos_financeiros**: `CREATE UNIQUE INDEX grupos_financeiros_pkey ON public.grupos_financeiros USING btree (id)`
- **grupos_financeiros**: `CREATE UNIQUE INDEX grupos_financeiros_nome_grupo_key ON public.grupos_financeiros USING btree (nome_grupo)`
- **grupos_financeiros_contratos**: `CREATE UNIQUE INDEX grupos_financeiros_contratos_pkey ON public.grupos_financeiros_contratos USING btree (id)`
- **grupos_financeiros_contratos**: `CREATE UNIQUE INDEX uniq_empresa_grupo_ativo ON public.grupos_financeiros_contratos USING btree (empresa_id) WHERE (ativo = true)`
- **grupos_financeiros_contratos**: `CREATE INDEX idx_gfc_grupo ON public.grupos_financeiros_contratos USING btree (grupo_id) WHERE (ativo = true)`
- **movimentacao_fechamento_historico**: `CREATE UNIQUE INDEX movimentacao_fechamento_historico_pkey ON public.movimentacao_fechamento_historico USING btree (id)`
- **movimentacao_fechamento_historico**: `CREATE UNIQUE INDEX movimentacao_fechamento_historico_anexo_id_key ON public.movimentacao_fechamento_historico USING btree (anexo_id)`
- **movimentacao_relatorio_envios**: `CREATE UNIQUE INDEX movimentacao_relatorio_envios_pkey ON public.movimentacao_relatorio_envios USING btree (id)`
- **movimentacao_relatorio_envios**: `CREATE UNIQUE INDEX movimentacao_relatorio_envios_envio_id_movimentacao_id_key ON public.movimentacao_relatorio_envios USING btree (envio_id, movimentacao_id)`
- **movimentacao_relatorio_envios**: `CREATE INDEX movimentacao_relatorio_envios_consulta ON public.movimentacao_relatorio_envios USING btree (movimentacao_id, enviado_em DESC)`
- **movimentacao_relatorios**: `CREATE UNIQUE INDEX movimentacao_relatorios_pkey ON public.movimentacao_relatorios USING btree (movimentacao_id)`
- **movimentacao_suspensos_encaminhamentos**: `CREATE UNIQUE INDEX movimentacao_suspensos_encaminhamentos_pkey ON public.movimentacao_suspensos_encaminhamentos USING btree (id)`
- **movimentacao_suspensos_encaminhamentos**: `CREATE UNIQUE INDEX movimentacao_suspensos_encaminham_empresa_id_mes_referencia_key ON public.movimentacao_suspensos_encaminhamentos USING btree (empresa_id, mes_referencia)`
- **movimentacoes**: `CREATE UNIQUE INDEX movimentacoes_pkey ON public.movimentacoes USING btree (id)`
- **movimentacoes**: `CREATE INDEX idx_movimentacoes_empresa_id ON public.movimentacoes USING btree (empresa_id)`
- **movimentacoes**: `CREATE INDEX idx_movimentacoes_mes_referencia ON public.movimentacoes USING btree (mes_referencia)`
- **movimentacoes**: `CREATE INDEX idx_movimentacoes_periodo ON public.movimentacoes USING btree (periodo)`
- **movimentacoes**: `CREATE UNIQUE INDEX movimentacoes_empresa_mes_periodo_uniq ON public.movimentacoes USING btree (empresa_id, mes_referencia, periodo)`

## Apêndice D — Triggers

- **alertas_financeiro**: `CREATE TRIGGER update_alertas_fin_updated_at BEFORE UPDATE ON public.alertas_financeiro FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
- **anexos_movimentacao**: `CREATE TRIGGER anexo_importado_historico AFTER INSERT ON public.anexos_movimentacao FOR EACH ROW EXECUTE FUNCTION auditar_anexo_importado()`
- **anexos_movimentacao**: `CREATE TRIGGER validar_anexo_repositorio BEFORE INSERT ON public.anexos_movimentacao FOR EACH ROW EXECUTE FUNCTION validar_anexo_repositorio()`
- **empresa_suspensoes**: `CREATE TRIGGER trg_empresa_suspensoes_updated_at BEFORE UPDATE ON public.empresa_suspensoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
- **empresas**: `CREATE TRIGGER empresas_set_ultima_alteracao BEFORE INSERT OR UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION trg_empresas_set_ultima_alteracao()`
- **empresas**: `CREATE TRIGGER proteger_empresa_endereco_principal BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION proteger_empresa_endereco_principal()`
- **empresas**: `CREATE TRIGGER trg_empresa_suspensao_fluxo AFTER UPDATE OF contrato_suspenso ON public.empresas FOR EACH ROW EXECUTE FUNCTION trg_empresa_suspensao_fluxo()`
- **empresas**: `CREATE TRIGGER trg_guard_empresas_executivo BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION guard_empresas_executivo()`
- **empresas**: `CREATE TRIGGER trg_implantacao AFTER UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION notify_implantacao()`
- **empresas**: `CREATE TRIGGER trg_nova_empresa AFTER INSERT ON public.empresas FOR EACH ROW EXECUTE FUNCTION notify_nova_empresa()`
- **empresas**: `CREATE TRIGGER trg_sync_empresa_responsavel AFTER INSERT OR UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION sync_empresa_responsavel()`
- **empresas**: `CREATE TRIGGER trg_sync_periodo_movimentacoes AFTER UPDATE OF data_corte, periodo_movimentacao, tipo_movimentacao, tipo_contrato ON public.empresas FOR EACH ROW EXECUTE FUNCTION sync_periodo_movimentacoes_empresa()`
- **empresas**: `CREATE TRIGGER trg_sync_tipo_cobranca_from_empresa AFTER UPDATE OF tipo_financeiro ON public.empresas FOR EACH ROW EXECUTE FUNCTION sync_tipo_cobranca_from_empresa()`
- **empresas**: `CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
- **empresas**: `CREATE TRIGGER validar_empresa_enderecos BEFORE INSERT OR UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION validar_empresa_enderecos()`
- **empresas**: `CREATE TRIGGER validar_produtos_empresa BEFORE INSERT OR UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION validar_produtos_empresa()`
- **grupos_financeiros**: `CREATE TRIGGER trg_grupos_financeiros_updated_at BEFORE UPDATE ON public.grupos_financeiros FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
- **grupos_financeiros_contratos**: `CREATE TRIGGER trg_gfc_updated_at BEFORE UPDATE ON public.grupos_financeiros_contratos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
- **movimentacao_relatorio_envios**: `CREATE TRIGGER historico_envios_imutavel BEFORE DELETE OR UPDATE ON public.movimentacao_relatorio_envios FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_envio_relatorio()`
- **movimentacao_relatorios**: `CREATE TRIGGER validar_movimentacao_relatorio BEFORE INSERT OR UPDATE ON public.movimentacao_relatorios FOR EACH ROW EXECUTE FUNCTION validar_movimentacao_relatorio()`
- **movimentacoes**: `CREATE TRIGGER trg_ferias_check_retorno AFTER INSERT OR UPDATE OF data_envio_financeiro ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION trg_ferias_check_retorno()`
- **movimentacoes**: `CREATE TRIGGER trg_fin_mark_aguardando_nota AFTER INSERT OR UPDATE OF data_envio_financeiro ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION fin_mark_aguardando_nota()`
- **movimentacoes**: `CREATE TRIGGER trg_guard_mov_comum BEFORE UPDATE ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION guard_movimentacoes_comum()`
- **movimentacoes**: `CREATE TRIGGER trg_normalize_admin_movimentacao_periodo BEFORE INSERT OR UPDATE OF empresa_id, periodo ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION normalize_admin_movimentacao_periodo()`
- **movimentacoes**: `CREATE TRIGGER trg_remove_alerta_vencimento_on_unset AFTER UPDATE OF data_envio_financeiro ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION remove_alerta_vencimento_on_unset()`
- **movimentacoes**: `CREATE TRIGGER trg_sync_alerta_data_envio AFTER UPDATE OF data_envio_financeiro ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION sync_alerta_data_envio()`
- **movimentacoes**: `CREATE TRIGGER update_movimentacoes_updated_at BEFORE UPDATE ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`

## Apêndice E — Policies RLS (trecho de até 300 caracteres da expressão)

- **alertas_financeiro** — `Admin manage alertas_financeiro` (ALL) USING: `has_role(auth.uid(), 'admin'::app_role)` CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **alertas_financeiro** — `Admin read alertas_financeiro` (SELECT) USING: `has_role(auth.uid(), 'admin'::app_role)` CHECK: `<nil>`
- **alertas_financeiro** — `Diretora visualizacao read alertas_financeiro` (SELECT) USING: `(has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.uid(), 'visualizacao'::app_role))` CHECK: `<nil>`
- **alertas_financeiro** — `Financeiro manage alertas_financeiro` (ALL) USING: `has_role(auth.uid(), 'financeiro'::app_role)` CHECK: `has_role(auth.uid(), 'financeiro'::app_role)`
- **alertas_financeiro** — `Financeiro read alertas_financeiro` (SELECT) USING: `has_role(auth.uid(), 'financeiro'::app_role)` CHECK: `<nil>`
- **anexos_movimentacao** — `Admin manage anexos_movimentacao` (ALL) USING: `has_role(auth.uid(), 'admin'::app_role)` CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **anexos_movimentacao** — `Administradoras delete anexos_movimentacao` (DELETE) USING: `has_role(auth.uid(), 'administradoras'::app_role)` CHECK: `<nil>`
- **anexos_movimentacao** — `Administradoras insert anexos_movimentacao` (INSERT) USING: `<nil>` CHECK: `(has_role(auth.uid(), 'administradoras'::app_role) AND (uploaded_by = auth.uid()))`
- **anexos_movimentacao** — `Comum delete anexos_movimentacao` (DELETE) USING: `has_role(auth.uid(), 'comum'::app_role)` CHECK: `<nil>`
- **anexos_movimentacao** — `Comum insert anexos_movimentacao` (INSERT) USING: `<nil>` CHECK: `(has_role(auth.uid(), 'comum'::app_role) AND (uploaded_by = auth.uid()))`
- **anexos_movimentacao** — `Executivo externo insert anexos_movimentacao` (INSERT) USING: `<nil>` CHECK: `(has_role(auth.uid(), 'executivo_externo'::app_role) AND (uploaded_by = auth.uid()))`
- **anexos_movimentacao** — `Executivo externo read anexos_movimentacao` (SELECT) USING: `has_role(auth.uid(), 'executivo_externo'::app_role)` CHECK: `<nil>`
- **anexos_movimentacao** — `Financeiro manage anexos_movimentacao` (ALL) USING: `has_role(auth.uid(), 'financeiro'::app_role)` CHECK: `has_role(auth.uid(), 'financeiro'::app_role)`
- **anexos_movimentacao** — `Internal roles read anexos_movimentacao` (SELECT) USING: `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.uid(), 'visualizacao'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.ui` CHECK: `<nil>`
- **empresa_suspensoes** — `Cadastro manage empresa_suspensoes` (ALL) USING: `(has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role))` CHECK: `(has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role))`
- **empresa_suspensoes** — `Internal roles read empresa_suspensoes` (SELECT) USING: `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.uid(), 'visualizacao'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.ui` CHECK: `<nil>`
- **empresa_usuarios** — `Admin manage all empresa_usuarios` (ALL) USING: `has_role(auth.uid(), 'admin'::app_role)` CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **empresa_usuarios** — `Administradoras view all empresa_usuarios` (SELECT) USING: `has_role(auth.uid(), 'administradoras'::app_role)` CHECK: `<nil>`
- **empresa_usuarios** — `Diretora view all empresa_usuarios` (SELECT) USING: `has_role(auth.uid(), 'diretora'::app_role)` CHECK: `<nil>`
- **empresa_usuarios** — `Enfermeira view all empresa_usuarios` (SELECT) USING: `has_role(auth.uid(), 'enfermeira'::app_role)` CHECK: `<nil>`
- **empresa_usuarios** — `Executivo view all empresa_usuarios` (SELECT) USING: `has_role(auth.uid(), 'executivo'::app_role)` CHECK: `<nil>`
- **empresa_usuarios** — `Financeiro view all empresa_usuarios` (SELECT) USING: `has_role(auth.uid(), 'financeiro'::app_role)` CHECK: `<nil>`
- **empresa_usuarios** — `User view own empresa_usuarios` (SELECT) USING: `(user_id = auth.uid())` CHECK: `<nil>`
- **empresa_usuarios** — `Visualizacao view all empresa_usuarios` (SELECT) USING: `has_role(auth.uid(), 'visualizacao'::app_role)` CHECK: `<nil>`
- **empresas** — `Admin full access empresas` (ALL) USING: `has_role(auth.uid(), 'admin'::app_role)` CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **empresas** — `Administradoras insert empresas` (INSERT) USING: `<nil>` CHECK: `has_role(auth.uid(), 'administradoras'::app_role)`
- **empresas** — `Administradoras update empresas` (UPDATE) USING: `has_role(auth.uid(), 'administradoras'::app_role)` CHECK: `has_role(auth.uid(), 'administradoras'::app_role)`
- **empresas** — `Administradoras view all empresas` (SELECT) USING: `has_role(auth.uid(), 'administradoras'::app_role)` CHECK: `<nil>`
- **empresas** — `Comum user insert empresas` (INSERT) USING: `<nil>` CHECK: `has_role(auth.uid(), 'comum'::app_role)`
- **empresas** — `Comum user update empresas` (UPDATE) USING: `has_role(auth.uid(), 'comum'::app_role)` CHECK: `has_role(auth.uid(), 'comum'::app_role)`
- **empresas** — `Comum view empresas` (SELECT) USING: `has_role(auth.uid(), 'comum'::app_role)` CHECK: `<nil>`
- **empresas** — `Diretora view all empresas` (SELECT) USING: `has_role(auth.uid(), 'diretora'::app_role)` CHECK: `<nil>`
- **empresas** — `Enfermeira update contato empresas` (UPDATE) USING: `has_role(auth.uid(), 'enfermeira'::app_role)` CHECK: `has_role(auth.uid(), 'enfermeira'::app_role)`
- **empresas** — `Enfermeira view empresas` (SELECT) USING: `has_role(auth.uid(), 'enfermeira'::app_role)` CHECK: `<nil>`
- **empresas** — `Executivo externo view all empresas` (SELECT) USING: `has_role(auth.uid(), 'executivo_externo'::app_role)` CHECK: `<nil>`
- **empresas** — `Executivo update empresas` (UPDATE) USING: `has_role(auth.uid(), 'executivo'::app_role)` CHECK: `has_role(auth.uid(), 'executivo'::app_role)`
- **empresas** — `Executivo view all empresas` (SELECT) USING: `has_role(auth.uid(), 'executivo'::app_role)` CHECK: `<nil>`
- **empresas** — `Financeiro update empresas` (UPDATE) USING: `has_role(auth.uid(), 'financeiro'::app_role)` CHECK: `has_role(auth.uid(), 'financeiro'::app_role)`
- **empresas** — `Financeiro view empresas` (SELECT) USING: `has_role(auth.uid(), 'financeiro'::app_role)` CHECK: `<nil>`
- **empresas** — `Tec enfermagem update contato empresas` (UPDATE) USING: `has_role(auth.uid(), 'tec_enfermagem'::app_role)` CHECK: `<nil>`
- **empresas** — `Tec enfermagem view empresas` (SELECT) USING: `has_role(auth.uid(), 'tec_enfermagem'::app_role)` CHECK: `<nil>`
- **empresas** — `Vendas view empresas` (SELECT) USING: `has_role(auth.uid(), 'vendas'::app_role)` CHECK: `<nil>`
- **empresas** — `Visualizacao view all empresas` (SELECT) USING: `has_role(auth.uid(), 'visualizacao'::app_role)` CHECK: `<nil>`
- **empresas** — `admin_empresa pode ver a propria empresa` (SELECT) USING: `user_pode_ver_empresa(id)` CHECK: `<nil>`
- **empresas** — `empresas_externo_read` (SELECT) USING: `(has_role(auth.uid(), 'executivo_externo'::app_role) AND ((responsavel_user_id = auth.uid()) OR (executiva_user_id = auth.uid()) OR (EXISTS ( SELECT 1 FROM empresa_usuarios eu WHERE ((eu.empresa_id = empresas.id) AND (eu.user_id = auth.uid()))))))` CHECK: `<nil>`
- **grupos_financeiros** — `Admins/Financeiro manage grupos_financeiros` (ALL) USING: `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))` CHECK: `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))`
- **grupos_financeiros** — `Internal roles read grupos_financeiros` (SELECT) USING: `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role) OR has_role(auth.uid(), 'visualizacao'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.ui` CHECK: `<nil>`
- **grupos_financeiros_contratos** — `Admins/Financeiro manage gfc` (ALL) USING: `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))` CHECK: `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))`
- **grupos_financeiros_contratos** — `Internal roles read gfc` (SELECT) USING: `(has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role) OR has_role(auth.uid(), 'visualizacao'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.ui` CHECK: `<nil>`
- **movimentacao_fechamento_historico** — `fechamento_historico_continuar` (INSERT) USING: `<nil>` CHECK: `((evento = 'continuacao_pendente'::text) AND (usuario_id = auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role)) AND (EXISTS ( SELECT 1 FROM moviment`
- **movimentacao_fechamento_historico** — `fechamento_historico_ler` (SELECT) USING: `(EXISTS ( SELECT 1 FROM movimentacoes m WHERE (m.id = movimentacao_fechamento_historico.movimentacao_id)))` CHECK: `<nil>`
- **movimentacao_relatorio_envios** — `Consultar envios conforme movimentacao` (SELECT) USING: `(EXISTS ( SELECT 1 FROM movimentacoes m WHERE (m.id = movimentacao_relatorio_envios.movimentacao_id)))` CHECK: `<nil>`
- **movimentacao_relatorios** — `Atualizacao manual por gestores da movimentacao` (UPDATE) USING: `((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role)) AND (EXISTS ( SELECT 1 FROM movimentacoes m WHERE (m.id = movimentacao_relatorios.movimentacao_id))))` CHECK: `((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role)) AND (EXISTS ( SELECT 1 FROM movimentacoes m WHERE (m.id = movimentacao_relatorios.movimentacao_id))))`
- **movimentacao_relatorios** — `Leitura conforme movimentacao` (SELECT) USING: `(EXISTS ( SELECT 1 FROM movimentacoes m WHERE (m.id = movimentacao_relatorios.movimentacao_id)))` CHECK: `<nil>`
- **movimentacao_relatorios** — `Registro manual por gestores da movimentacao` (INSERT) USING: `<nil>` CHECK: `((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role)) AND (EXISTS ( SELECT 1 FROM movimentacoes m WHERE (m.id = movimentacao_relatorios.movimentacao_id))))`
- **movimentacao_suspensos_encaminhamentos** — `Autenticados leem encaminhamentos de suspensos` (SELECT) USING: `(EXISTS ( SELECT 1 FROM empresas e WHERE (e.id = movimentacao_suspensos_encaminhamentos.empresa_id)))` CHECK: `<nil>`
- **movimentacoes** — `Admin full access movimentacoes` (ALL) USING: `has_role(auth.uid(), 'admin'::app_role)` CHECK: `has_role(auth.uid(), 'admin'::app_role)`
- **movimentacoes** — `Administradoras insert movimentacoes` (INSERT) USING: `<nil>` CHECK: `has_role(auth.uid(), 'administradoras'::app_role)`
- **movimentacoes** — `Administradoras update movimentacoes` (UPDATE) USING: `has_role(auth.uid(), 'administradoras'::app_role)` CHECK: `has_role(auth.uid(), 'administradoras'::app_role)`
- **movimentacoes** — `Administradoras view all movimentacoes` (SELECT) USING: `has_role(auth.uid(), 'administradoras'::app_role)` CHECK: `<nil>`
- **movimentacoes** — `Comum user insert movimentacoes` (INSERT) USING: `<nil>` CHECK: `has_role(auth.uid(), 'comum'::app_role)`
- **movimentacoes** — `Comum user update movimentacoes` (UPDATE) USING: `has_role(auth.uid(), 'comum'::app_role)` CHECK: `has_role(auth.uid(), 'comum'::app_role)`
- **movimentacoes** — `Diretora view all movimentacoes` (SELECT) USING: `has_role(auth.uid(), 'diretora'::app_role)` CHECK: `<nil>`
- **movimentacoes** — `Executivo view all movimentacoes` (SELECT) USING: `has_role(auth.uid(), 'executivo'::app_role)` CHECK: `<nil>`
- **movimentacoes** — `Financeiro insert movimentacoes` (INSERT) USING: `<nil>` CHECK: `has_role(auth.uid(), 'financeiro'::app_role)`
- **movimentacoes** — `Financeiro view all movimentacoes` (SELECT) USING: `has_role(auth.uid(), 'financeiro'::app_role)` CHECK: `<nil>`
- **movimentacoes** — `User update linked movimentacoes` (UPDATE) USING: `((has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role)) AND ((EXISTS ( SELECT 1 FROM empresa_usuarios eu WHERE ((eu.empresa_id = movimentacoes.empresa_id) AND (eu.user_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM empresas e WHERE ((e.id = movimenta` CHECK: `<nil>`
- **movimentacoes** — `User view linked movimentacoes` (SELECT) USING: `((EXISTS ( SELECT 1 FROM empresa_usuarios eu WHERE ((eu.empresa_id = movimentacoes.empresa_id) AND (eu.user_id = auth.uid())))) OR (EXISTS ( SELECT 1 FROM empresas e WHERE ((e.id = movimentacoes.empresa_id) AND (e.responsavel_user_id = auth.uid())))))` CHECK: `<nil>`
- **movimentacoes** — `Visualizacao view all movimentacoes` (SELECT) USING: `has_role(auth.uid(), 'visualizacao'::app_role)` CHECK: `<nil>`
- **movimentacoes** — `admin_empresa pode ver movimentacoes da propria empresa` (SELECT) USING: `user_pode_ver_empresa(empresa_id)` CHECK: `<nil>`
