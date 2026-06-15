## Avaliação RH — restauração e ajustes

Recoloca o formulário com as 5 perguntas em escala 1–5, adiciona os campos extras pedidos e permite resposta pública (sem login) via link único.

### 1. Banco de dados (migração)

Tabela `cs_avaliacao_respostas` — adicionar colunas:
- `nota_media` (numeric) — média das respostas de rating
- `comentario` (text, opcional)
- `nome_empresa` (text, obrigatório no envio)
- `nome_executiva` (text, obrigatório no envio)
- `compartilhamento_id` (uuid, opcional) — para distinguir origem do link compartilhado

RLS:
- Manter leitura restrita a admin/diretora/executivo
- **Adicionar política de INSERT pública (anon + authenticated)** para que o link funcione sem login

### 2. Template do formulário (`AvaliacoesRH.tsx`)

Repopular `TEMPLATE_RH` com:

| # | Título | Descrição |
|---|---|---|
| 1 | Relacionamento e cordialidade | A qualidade do relacionamento, cordialidade e profissionalismo demonstrados pela executiva durante os atendimentos. |
| 2 | Proatividade e comprometimento | A executiva demonstra iniciativa e presteza para auxiliá-los para as demandas apresentadas? |
| 3 | Agilidade e efetividade | O tempo de resposta e a capacidade de conduzir as demandas de forma eficiente até sua resolução. |
| 4 | Disponibilidade e suporte | A facilidade de contato e o suporte prestado sempre que sua empresa necessita de auxílio. |
| 5 | Satisfação geral | Considerando sua experiência como um todo, qual sua avaliação sobre o atendimento prestado pela executiva? |

Instruções: "Em uma escala de 1 a 5, sendo 1 = Insatisfatório e 5 = Excelente, como você avalia:"

Todas tipo `rating`, obrigatórias. O comentário deixa de ser uma pergunta e vira campo fixo no responder.

### 3. Página pública (`ResponderRH.tsx`)

- Remover o campo "Seu nome (opcional)"
- Adicionar dois inputs **obrigatórios** no topo: **Nome da Empresa** e **Executiva Avaliada**
- Adicionar **Comentário (opcional)** como textarea após as 5 perguntas
- Ao enviar:
  - calcular `nota_media` = média das 5 respostas
  - gravar `nome_empresa`, `nome_executiva`, `comentario`, `nota_media`, `respostas`, `compartilhamento_id` (lido de query string `?s=<uuid>` quando presente)
- Validar empresa/executiva preenchidos antes de enviar

### 4. Não incluído nesta etapa
- Tela de listagem/análise das respostas (rankings, médias por executiva) — pode ser próxima iteração
- Geração/gestão de links com `compartilhamento_id` distintos — por ora apenas captura se vier na URL

Confirma para eu implementar?
