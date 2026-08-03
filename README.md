# Aniversariantes

Painel para gerenciar mensagens automáticas de aniversário de pacientes: lista os
aniversariantes do mês (via API e-Clínica), permite agendar o envio de um
template aprovado no WhatsApp (via Helena/wts.chat) e acompanhar o histórico
de envios/cancelamentos.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Supabase (projeto **Clinic Control**, schema `public`, tabelas prefixadas
  `aniversariantes_*`) para credenciais por clínica, configuração de templates
  e histórico de envios
- Integrações externas:
  - **e-Clínica** (`https://eclinica.app/api/v2/aniversariantes`) — origem dos aniversariantes
  - **Helena / wts.chat** (`https://api.wts.chat`) — templates aprovados e agendamento de mensagens (`/chat/v1/scheduled-message`)

## Estrutura

- `src/lib/eclinica.ts` — cliente e-Clínica (lista aniversariantes)
- `src/lib/helena.ts` — cliente Helena (templates, criar/cancelar mensagem agendada)
- `src/lib/clinicas.ts` / `src/lib/supabase.ts` — acesso às tabelas de configuração
- `src/app/api/*` — rotas server-side (nunca expõem tokens ao browser)
- `src/app/page.tsx` — tela **Aniversariantes** (lista + agendar)
- `src/app/modelos` — tela **Modelos de mensagem** (mapear variáveis do template)
- `src/app/historico` — tela **Histórico** (status + cancelamento)

Multi-clínica via query param `?clinica=<slug>` (mesmo padrão do DashBoard-s):
uma única URL/deploy serve todas as clínicas cadastradas na tabela
`aniversariantes_clinicas`.

## Setup

1. `npm install`
2. Copiar `.env.example` para `.env.local` e preencher `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do projeto
   Supabase "Clinic Control".
3. Rodar a migration em `supabase/migrations/20260803_aniversariantes_init.sql`
   (cria as tabelas + insere a clínica Oral Foz como seed).
4. `npm run dev`

Para adicionar uma nova clínica: inserir uma linha em `aniversariantes_clinicas`
com `slug`, `nome`, `eclinica_token` e `helena_token` — nenhum código muda.

## Fluxo de agendamento

1. Tela **Modelos de mensagem** lista os templates `SCHEDULEDMESSAGE` aprovados
   na Helena e permite mapear as variáveis (`{{1}}`, `{{2}}`...) para campos do
   paciente (nome, primeiro nome, data de nascimento, dia de aniversário) e
   marcar um como padrão.
2. Tela **Aniversariantes** lista quem faz aniversário no mês filtrado
   (`GET /aniversariantes?mes=MM` na e-Clínica) e mostra status de envio.
3. Ao clicar em "Agendar mensagem", abre modal com prévia do texto já
   preenchido, permite ajustar a data/hora e confirma via
   `POST /chat/v1/scheduled-message`. O registro fica salvo em
   `aniversariantes_envios` com chave única `(clinica, paciente, ano)` para
   evitar reagendar/duplicar o parabéns no mesmo ano.
4. Tela **Histórico** lista todos os envios e permite cancelar os que ainda
   estão com status `scheduled`.
