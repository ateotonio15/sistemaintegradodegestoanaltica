# Implantação de Contratos — Wizard Inteligente

Nova aba completa com wizard de 6 etapas, extração automática de dados do "Anexo 1" via IA, e estrutura dedicada no banco.

## Banco de Dados

**Nova tabela `implantacoes_contratos`:**
- `id`, `empresa_id` (opcional, vinculado quando implantado), `status` (em_implantacao | aguardando_documentos | em_validacao | implantado | pendente_ajuste)
- Dados extraíveis: `nome_empresa`, `cnpj`, `telefone`, `inscricao_municipal`, `inscricao_estadual`, `endereco`, `cep`, `grupo_contrato`, `valor_enfermaria_centavos`, `valor_apartamento_centavos`, `inicio_atendimento`
- Dados contratuais: `data_vigencia`, `data_vencimento`, `dia_movimentacao`, `ticket`, `modalidade`, `acomodacao`, `corretora`, `codigo_contrato`
- Comissão: `percentual_agenciamento`, `percentual_vitalicio`
- Vidas: `total_vidas`, `faixas_etarias` (jsonb)
- Auditoria: `created_by`, `created_at`, `updated_at`, `etapa_atual` (1-6)

**Nova tabela `implantacao_anexos`:**
- `id`, `implantacao_id`, `tipo` (anexo_1 | contrato | relatorio_vidas | complementar), `nome_arquivo`, `storage_path`, `mime_type`, `tamanho_bytes`, `uploaded_by`, `created_at`

**Novo bucket Storage:** `anexos-implantacao` (privado)

**RLS:** Admin (full), Comum/Cadastro (full), Visualização/Diretora (read). Demais perfis sem acesso.

**Logs:** Tabela `implantacao_logs` com `implantacao_id`, `acao`, `detalhes` (jsonb), `user_id`, `user_nome`, `created_at`.

## Frontend

**Rotas e menu:**
- Nova rota `/implantacao` em `App.tsx` (acesso: Admin, Comum)
- Item de menu em `AppLayout.tsx` com ícone `FileSignature` (lucide)

**Página `src/pages/Implantacao.tsx`:**
- Lista de implantações com filtros (status), botão "Nova Implantação"
- Cards com: empresa, status (badge colorido), etapa atual, progresso

**Wizard `src/components/implantacao/ImplantacaoWizard.tsx`:**
- Header: progress bar horizontal (desktop) / vertical (mobile) com 6 steps numerados
- Salvamento automático a cada mudança de etapa (upsert na tabela)
- Botões "Voltar" / "Avançar" com `disabled` por validação Zod

**Componentes por etapa em `src/components/implantacao/steps/`:**
1. `Step1Upload.tsx` — Drag-and-drop com `react-dropzone` style nativo, separado por tipo (Anexo 1 destacado), preview em lista
2. `Step2Extracao.tsx` — Botão "Extrair dados do Anexo 1" → chama edge function, exibe campos extraídos editáveis
3. `Step3DadosContratuais.tsx` — Formulário com validações Zod (CNPJ, CEP, datas)
4. `Step4Comissionamento.tsx` — Inputs % + cálculo automático e resumo
5. `Step5RelatorioVidas.tsx` — Upload + parser básico Excel (contagem de linhas/faixas)
6. `Step6Revisao.tsx` — Resumo completo read-only + botão "Concluir Implantação"

## Edge Function: `extrair-anexo1`

- Recebe `storage_path` do Anexo 1
- Faz download via service role
- Se PDF → extrai texto (pdf-parse via npm:) ou OCR via IA Gateway com modelo multimodal
- Envia para Lovable AI (`google/gemini-3-flash-preview`) com `Output.object` (Zod schema) extraindo: nome_empresa, cnpj, telefone, inscrição municipal/estadual, endereço, cep, grupo_contrato, valor_enfermaria, valor_apartamento, inicio_atendimento
- Retorna JSON estruturado

## Validações

- CNPJ: validador algorítmico (14 dígitos + DV)
- CEP: regex `^\d{5}-?\d{3}$`
- Datas: válidas e coerentes (vigência ≤ vencimento futuro)
- Duplicidade: bloquear `codigo_contrato` já existente em `empresas` ou outra implantação

## Dashboard

Adicionar 4 KPIs no `Dashboard.tsx` (somente Admin/Cadastro):
- Contratos implantados (mês)
- Em implantação (pendentes)
- Documentos faltando
- Validação pendente

## Permissões

- **Admin / Comum (Cadastro):** acesso total
- **Visualização / Diretora:** somente leitura
- **Demais:** sem acesso (rota redirect para `/`)

## Status colors (badges)

- `em_implantacao` → azul
- `aguardando_documentos` → amarelo
- `em_validacao` → laranja
- `implantado` → verde
- `pendente_ajuste` → vermelho

## Fora de escopo (confirmar)

- Integração automática que cria registro em `empresas` ao concluir: incluso (cria empresa com `status_empresa='Ativa'` se não existir, ou vincula `empresa_id` se já existir pelo CNPJ)
- OCR de imagens scaneadas: usar Gemini multimodal (envia PDF como inline data)
