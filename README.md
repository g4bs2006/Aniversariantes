# Aniversariantes

Painel embutido na Helena (aba/iframe dentro da plataforma da clínica) para
gerenciar mensagens automáticas de aniversário de pacientes: lista quem faz
aniversário no mês, agenda o envio de um template aprovado no WhatsApp e
acompanha o histórico de envios/cancelamentos.

Multi-clínica de verdade — o frontend tem um seletor de clínica (ver
[Multi-clínica](#multi-clínica)) e cada clínica usa o sistema de prontuário
que tiver: hoje **e-Clínica** (Oral Foz) ou **Clinicorp** (ver
[Clinicorp](#clinicorp-e-o-cache-de-aniversariantes) — a API dela não permite
listar aniversariantes por mês, então essa integração depende de um cron de
sync, diferente da e-Clínica que busca ao vivo).

## Acesso

O app **não tem login**. O acesso é por **link assinado**, e o token no link
carrega o slug da clínica — é ele, e não o request, que define de qual clínica
aquele acesso vê os dados.

```
Clinic Control  ──assina com ANIVERSARIANTES_LINK_SECRET──▶  ?t=<token>
                                                                  │
                                          src/proxy.ts verifica ───┤
                                                                  ▼
                                    header x-clinica-slug (confiável)
                                                                  │
                                              rotas de API ───────┘
```

- **Aba da Helena de cada clínica:** link **sem expiração**, colado uma vez na
  configuração da aba. É a credencial de longa duração daquela clínica.
- **Botão "Abrir Aniversariantes" no Clinic Control:** link com expiração curta,
  para a equipe interna abrir no contexto de uma clínica.
- `GET /api/cron/sync-clinicorp` fica fora do gate — tem o próprio `CRON_SECRET`
  e roda para todas as clínicas, não no escopo de uma.

Sem `ANIVERSARIANTES_LINK_SECRET` o app **rejeita todo acesso**, de propósito:
sem segredo não há como distinguir token válido de forjado.

### Limites, e por quanto tempo eles valem

Quem tem o link tem acesso àquela clínica. O link da aba da Helena **não
expira**, e hoje **não há como revogar o de uma clínica** sem rotacionar o
segredo, o que derruba os de todas.

Isso importa mais do que pareceria, porque **o token não é um paliativo
esperando uma sessão chegar.** Para o acesso da equipe interna, sim: ele morre
quando o setup virar rota do Clinic Control. Mas o operacional é usado pelo
**pessoal da clínica**, e dar sessão do Clinic Control a eles é exatamente o que
o [ADR 0003](https://github.com/g4bs2006/Clinic-Control/blob/main/docs/adr/0003-sem-painel-para-cliente-final.md)
recusa — o Clinic Control assume todo usuário autenticado como staff confiável,
sem isolamento por tenant no banco. Abrir isso exige RLS por clínica em todas as
tabelas: um projeto, não uma tela.

Ou seja: para metade do público, **este é o mecanismo de longo prazo**. As
dívidas que sobram estão rastreadas em
[Clinic-Control#74](https://github.com/g4bs2006/Clinic-Control/issues/74) —
revogação por clínica (um `kid` no payload), expiração no link da aba, e
procedimento de rotação.

Antes disto o app era **inteiramente aberto** na URL pública da Vercel, e cada
rota aceitava a clínica como parâmetro sem verificar direito de acesso. O
"embutido na Helena via iframe" descrito acima nunca foi controle de acesso —
um `<iframe>` não impede ninguém de abrir a URL direto.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS 4
- Supabase (projeto **Clinic Control**, `jggfnfxdtfqeqyvxufgu`, schema `public`,
  tabelas prefixadas `aniversariantes_*` pra não colidir com o resto do projeto)
- Integrações externas atuais:
  - **e-Clínica** (`https://eclinica.app/api/v2`) — sistema de prontuário/CRM,
    busca ao vivo (ver [Limitações conhecidas da e-Clínica](#limitações-conhecidas-da-e-clínica))
  - **Clinicorp** (`https://api.clinicorp.com/rest/v1`) — sistema de
    prontuário alternativo, só via cache/cron (ver
    [Clinicorp](#clinicorp-e-o-cache-de-aniversariantes))
  - **Helena / wts.chat** (`https://api.wts.chat`) — templates de WhatsApp
    aprovados e agendamento de mensagens (comum às duas)
- Vercel Cron (`vercel.json`) — dispara a sincronização diária da Clinicorp

## Estrutura

```
src/
├── app/
│   ├── api/                        # rotas server-side (únicas com acesso a tokens/service role)
│   │   ├── clinicas/               # GET  lista clínicas cadastradas
│   │   ├── aniversariantes/        # GET  aniversariantes do mês (e-Clínica ao vivo OU cache Clinicorp)
│   │   ├── templates/              # GET  templates aprovados + config salva / POST salva mapeamento
│   │   ├── scheduled-message/      # POST agenda envio
│   │   │   └── [id]/cancel/        # POST cancela (id = linha em aniversariantes_envios)
│   │   ├── historico/              # GET  lista todos os envios da clínica
│   │   └── cron/sync-clinicorp/    # GET  (Vercel Cron, 1x/dia) sincroniza o cache da Clinicorp
│   ├── page.tsx                    # tela Aniversariantes
│   ├── modelos/page.tsx             # tela Modelos de mensagem
│   └── historico/page.tsx           # tela Histórico
├── components/                     # Views (client components) + AppShell + ui/ (Button, Badge, Modal)
│   ├── ClinicaProvider.tsx         # contexto com a clínica ativa (lista via /api/clinicas, persiste em localStorage)
│   └── ClinicaSwitcher.tsx         # seletor de clínica no header (ver Multi-clínica)
├── lib/
│   ├── eclinica.ts                 # cliente do sistema de prontuário e-Clínica (busca ao vivo)
│   ├── clinicorp.ts                # cliente do sistema de prontuário Clinicorp (usado só pelo cron de sync)
│   ├── helena.ts                   # cliente do sistema de mensageria (hoje: Helena)
│   ├── clinicas.ts                 # lookup de clínica por slug (credenciais)
│   ├── supabase.ts                 # client admin (service role)
│   └── format.ts                   # normalização de telefone/data, cálculo de próxima ocorrência
└── types/
    ├── database.ts                 # tipos de domínio (Clinica, Aniversariante, Envio, TemplateConfig, PacienteCache...)
    └── supabase.ts                 # Database (schema tipado do supabase-js)
```

## Setup

1. `npm install`
2. Copiar `.env.example` para `.env.local` e preencher:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Supabase Dashboard → Clinic Control →
     Settings → API → `service_role` — **nunca** commitar esse valor)
   - `CRON_SECRET` (qualquer valor aleatório) — só é checado pela rota de
     cron, não afeta o `npm run dev` local
3. Rodar as migrations em `supabase/migrations/` (criam as tabelas; a seed de
   clínica real fica de fora do arquivo versionado — ver comentário no topo
   da migration)
4. `npm run dev`

Na Vercel, as mesmas 4 variáveis precisam estar cadastradas em Project
Settings → Environment Variables (o `.env.local` só vale local). O cron em
`vercel.json` é criado automaticamente no deploy (Hobby: só dispara 1x/dia,
por isso o schedule é diário).

## Modelo de dados (Supabase · `public`)

| Tabela | O que guarda |
|---|---|
| `aniversariantes_clinicas` | 1 linha por clínica: `slug`, `nome`, `sistema_prontuario` (`eclinica`/`clinicorp`), credenciais de ambos os prontuários (só as do sistema escolhido são obrigatórias — ver constraint na migration), `helena_token`, `helena_channel_id`, `helena_from`, `timezone` |
| `aniversariantes_pacientes_cache` | cache de aniversariantes só das clínicas Clinicorp, preenchido 1x/dia pelo cron `sync-clinicorp` — mês atual + próximo. A rota `aniversariantes` lê daqui em vez de chamar a Clinicorp na hora (ver [Clinicorp](#clinicorp-e-o-cache-de-aniversariantes)) |
| `aniversariantes_templates` | mapeamento de variáveis de um template Helena pros campos do paciente (`param_mapping`), dia/horário padrão de envio, qual é o template padrão |
| `aniversariantes_envios` | histórico de agendamentos: paciente, template usado, `scheduled_message_id` (id na Helena), status, data agendada. Chave única `(clinica_id, paciente_id_eclinica, ano)` — evita agendar parabéns duplicado no mesmo ano (nome da coluna é legado da e-Clínica, mas guarda o id do paciente também pra clínicas Clinicorp) |

RLS habilitada sem policies (deny-all) em todas — acesso só via
`service_role` no backend, mesmo padrão do Contact-Calendar.

> ### ⚠️ `aniversariantes_clinicas` tem um consumidor externo
>
> O **Clinic Control** (`g4bs2006/Clinic-Control`) lê **e escreve** nessa tabela:
> a tela de clínica dele provisiona o Aniversariantes via `upsert` com
> `onConflict: "slug"`. Ele vive no schema `clinic_control` do mesmo projeto
> Supabase e alcança este schema por um client `service_role` dedicado.
>
> Consequência prática: **remover coluna, renomear ou apertar constraint aqui é
> breaking change lá**, e nada neste repositório vai acusar. A constraint
> `aniversariantes_clinicas_prontuario_credenciais_check`, em particular, está
> duplicada em TypeScript no outro lado.
>
> Contrato coluna por coluna, com quem lê e quem escreve:
> [`docs/reference/schema-aniversariantes.md`](https://github.com/g4bs2006/Clinic-Control/blob/main/docs/reference/schema-aniversariantes.md)
> · decisão: [ADR 0006](https://github.com/g4bs2006/Clinic-Control/blob/main/docs/adr/0006-dono-unico-das-migrations.md)

## Fluxo de agendamento

1. **Modelos de mensagem** lista os templates aprovados na Helena
   (`GET /chat/v1/template?ApprovedOnly=true`) e permite mapear as variáveis
   (`{{1}}`, `{{2}}`...) pros campos do paciente (nome, primeiro nome, data de
   nascimento, dia de aniversário), definir dia/horário de envio e marcar um
   template como padrão. Isso é salvo em `aniversariantes_templates`.
2. **Aniversariantes** busca o cadastro da clínica na e-Clínica e filtra por
   mês no nosso lado (ver [Limitações conhecidas](#limitações-conhecidas-da-e-clínica)),
   cruzando com `aniversariantes_envios` pra mostrar status. Permite
   selecionar 1 ou vários pacientes e agendar em lote.
3. Confirmar abre prévia do texto já preenchido, permite ajustar data/hora
   (só faz sentido no agendamento individual) e chama
   `POST /chat/v1/scheduled-message`. Cada envio bem-sucedido vira uma linha
   em `aniversariantes_envios`.
4. **Histórico** lista todos os envios e permite cancelar os que ainda estão
   `scheduled` (`POST /chat/v1/scheduled-message/{id}/cancel`).

### Regra de data: só de hoje pra frente

Aniversário que já passou neste ano **não é agendável**. `nextOccurrence`
(em `lib/format.ts`) devolve `null` nesse caso, a rota de agendamento recusa
com erro explícito, e a lista marca o paciente com a etiqueta "já passou"
(campo `ja_passou` calculado no fuso da clínica, não no do servidor).

Se o aniversário é **hoje** mas o horário padrão do template já passou, o
envio vai pra alguns minutos à frente em vez de pular o dia — a Helena
rejeita agendamento no passado.

## Limitações conhecidas da e-Clínica

Descobertas testando a API direto (a doc pública em
`efficient.app.br/apidoc` diverge do comportamento real):

- **Parâmetros `mes`/`mesdia` quebram o backend deles (500).** Por isso
  `src/lib/eclinica.ts` sempre busca a lista completa (`GET /aniversariantes`
  sem query params) e o filtro por mês é feito em
  `src/app/api/aniversariantes/route.ts`. Isso significa buscar o cadastro
  inteiro da clínica a cada request (pode ser lento/pesado — não há
  paginação disponível).
- **O shape da resposta é instável.** A mesma chamada, sem nada de diferente,
  já respondeu ora com `nome`/`aniversario`/`datanascimento`/`situacao`, ora
  com `name`/`nascimento`/`clientesituacao_id`. `EClinicaCliente` (em
  `types/database.ts`) modela os dois shapes como campos opcionais, e
  `parseDataYMD`/`parseAniversarioPronto` (em `lib/format.ts`) tentam ambos.
- **Datas sentinela de campo vazio:** `"0000-00-00"`, `"0001-01-01"`,
  `"00/00"` aparecem no lugar de `null` quando o cadastro não tem data de
  nascimento. Tratadas como inválidas nos parsers acima.
- **`situacao`/`clientesituacao_id` não é um enum simples** (a doc dizia
  ATIVO/INATIVO) — vem com valores livres do CRM da clínica
  (`AGENDAMENTO`, `ARQUIVO MORTO`, `NUTRIÇÃO`, `CONSULTA`...). Só excluímos
  explicitamente `INATIVO` e `ARQUIVO MORTO`.
- **Telefones vêm sujos:** landline sem indicar que é fixo, número de 8
  dígitos sem o "9" que virou padrão pra celular, texto colado junto
  (`"9977-0408FILHA"`), valores placeholder (`"000000"`). `toE164BR` (em
  `lib/format.ts`) faz uma validação best-effort — a tela marca quem não
  passou como "telefone inválido" e desabilita o agendamento pra esse
  contato.

## Limitações conhecidas da Helena

- **O campo `type` do objeto retornado por `GET /chat/v1/template` não é a
  mesma coisa que o parâmetro de query `Type`.** `type` na resposta descreve
  o conteúdo do modelo (templates HSM comuns vêm com `type: "TEMPLATE"`,
  mesmo aprovados e usáveis em `scheduled-message`) — não confundir com a
  categoria de uso que o filtro `Type=SCHEDULEDMESSAGE` da query seleciona
  (ver enum em `Modelos_Mensagem/listar.md` na doc da Helena). `lib/helena.ts`
  filtra por `ApprovedOnly=true&Type=SCHEDULEDMESSAGE` (2026-08-12); se numa
  conta isso devolver vazio, cai automaticamente pra só `ApprovedOnly=true` e
  a tela de Modelos avisa que não deu pra garantir a exclusividade.
- **O texto do template vem no campo `text`, não `content`.**
- **"App Mensagens agendadas não está habilitado"** (`ENTITY_NOT_FOUND`) é um
  erro de conta, não do código — precisa habilitar o recurso de mensagens
  agendadas nas configurações da conta Helena da clínica.
- **Respostas de sucesso nem sempre têm corpo.** O `POST /chat/v1/scheduled-message/{id}/cancel`
  responde `200` com corpo vazio. `res.json()` direto estoura
  `Unexpected end of JSON input`, e um cancelamento que deu certo na Helena
  virava `500` no nosso lado (com o status local nunca sincronizando). O
  `unwrap` em `lib/helena.ts` lê o corpo como texto e devolve `null` quando
  vazio.
- **Cancelar uma mensagem que já não está mais `scheduled` na Helena**
  (por exemplo, foi cancelada direto na plataforma deles) retorna
  `ENTITY_ERROR_SAVE`. A rota de cancelamento trata esse caso como sucesso —
  sincroniza o status local em vez de estourar erro, já que o resultado que
  o usuário queria (não enviar mais) já é verdade.

## Multi-clínica

O frontend tem um seletor de clínica (`ClinicaSwitcher`, no header via
`AppShell` → `ClinicaProvider`): busca em `/api/clinicas`, guarda a escolha em
`localStorage` e todas as telas (`AniversariantesView`, `ModelosView`,
`HistoricoView`) leem a clínica ativa via `useClinica()`.

**Desde o gate de acesso (ver [Acesso](#acesso)), `/api/clinicas` devolve só a
clínica do escopo do token** — não a lista de todas as cadastradas. Com um único
item, o switcher já cai sozinho no caminho de nome fixo, sem dropdown. Trocar de
clínica é abrir o link de outra clínica, não escolher no menu.

As rotas de API **ignoram** `?clinica=<slug>` e `clinica_slug` no body. Os
parâmetros continuam sendo aceitos só para o frontend atual não quebrar; a
clínica vem do header `x-clinica-slug` que o `proxy.ts` grava depois de verificar
o token. Era exatamente o contrário disso — a rota confiando no slug do
request — que deixava qualquer chamador escolher a clínica.

Pra dar de alta uma clínica nova:
- **e-Clínica**: inserir linha com `slug`, `nome`, `eclinica_token` (e
  `eclinica_base_url` se não for a instância padrão), `helena_token`.
- **Clinicorp**: inserir linha com `sistema_prontuario = 'clinicorp'`,
  `clinicorp_usuario_api`, `clinicorp_token_api`, `clinicorp_subscriber_id`,
  `helena_token` — e esperar o próximo cron (`sync-clinicorp`, 1x/dia) rodar
  antes dela aparecer com dados na tela de Aniversariantes (ver seção abaixo).

## Clinicorp e o cache de aniversariantes

A Clinicorp (estudo em `docs/clinicorp-api.md`) só tem
`GET /patient/birthdays?date=YYYY-MM-DD`: aniversariantes de **um dia**, não
de um mês, e o status do paciente (`ACTIVE`/`INACTIVE`/`DELETED`) só vem em
`GET /patient/get` (1 chamada por paciente). Reconstruir "o mês" ao vivo a
cada carregamento da tela custaria até ~31 requests de aniversário + 1 por
paciente encontrado — inviável num serverless function da Vercel (plano
Hobby: cron só dispara 1x/dia, duração de function limitada).

Por isso a integração é **assíncrona**, não ao vivo como a e-Clínica:

1. `GET /api/cron/sync-clinicorp` (`src/app/api/cron/sync-clinicorp/route.ts`)
   roda 1x/dia via Vercel Cron (`vercel.json`), autenticado por `CRON_SECRET`.
   Pra cada clínica com `sistema_prontuario = 'clinicorp'`: busca os
   aniversariantes de cada dia do mês atual + o seguinte (concorrência
   limitada, não sequencial), enriquece com o status via `/patient/get` só
   dos pacientes encontrados (não da base inteira) e substitui o cache da
   clínica em `aniversariantes_pacientes_cache`.
2. `GET /api/aniversariantes` (branch por `clinica.sistema_prontuario`) lê
   esse cache com 1 query em vez de chamar a Clinicorp — mesmo contrato de
   resposta (`Aniversariante`) que a e-Clínica, a UI não sabe a diferença.

**Limites conhecidos, por decisão de escopo:**
- Cache cobre só mês atual + próximo — não dá pra navegar pra um mês
  distante numa clínica Clinicorp (não há caso de uso real pra isso: um
  aniversário passado não é agendável de qualquer forma).
- Frescor de até 1x/dia — um paciente cadastrado hoje na Clinicorp só aparece
  no painel depois do próximo cron. Não existe botão de "sincronizar agora".
- Se o cron falhar num dia, o cache simplesmente não atualiza (fica com os
  dados do dia anterior) — não há alerta automático hoje.

## Adicionando outros sistemas (EHR/PMS e mensageria)

O projeto já suporta 2 provedores de prontuário (e-Clínica ao vivo, Clinicorp
via cache) mas continua **um** provedor de mensageria (Helena) — não existe
uma interface formal de "provider" no código, é módulo concreto mesmo em
ambos os casos. Pra um terceiro provedor de prontuário:

1. Criar `src/lib/<sistema>.ts` com uma função que recebe as credenciais da
   clínica e devolve os dados brutos do sistema (sem se preocupar em bater
   exatamente com `EClinicaCliente`/`ClinicorpPatientBirthday` — cada API tem
   seu próprio shape).
2. Se o sistema novo permitir buscar por mês/intervalo, pode ir direto (ao
   vivo) em `src/app/api/aniversariantes/route.ts`, igual à e-Clínica. Se só
   permitir buscar por dia (como a Clinicorp), replicar o padrão de cache:
   um job de sync escreve em `aniversariantes_pacientes_cache` (ou uma tabela
   nova, se o shape não couber) e a rota lê de lá.
3. Adicionar um valor novo ao enum `sistema_prontuario` (`SistemaProntuario`
   em `types/database.ts` + a `check` constraint na migration) e o `switch`
   correspondente em `src/app/api/aniversariantes/route.ts`.
4. O contrato que `AniversariantesView`, `ScheduleModal` etc. esperam
   (`Aniversariante`: `id`, `nome`, `telefone`, `celular`, `aniversario`
   "MM/DD", `datanascimento` "DD/MM/AAAA", `situacao`) não muda — normalizar
   pra esse formato na rota evita tocar em componente de tela.

**Novo provedor de mensageria:**
1. Criar `src/lib/<provedor>.ts` espelhando as 3 funções de `lib/helena.ts`:
   listar templates aprovados, criar mensagem agendada, cancelar mensagem
   agendada. Mesma ideia: a assinatura pode ser diferente, o que importa é
   `src/app/api/templates/route.ts` e `src/app/api/scheduled-message/*`
   devolverem o mesmo formato de resposta que o frontend já consome.
2. Adicionar coluna `sistema_mensageria` em `aniversariantes_clinicas`.

Não vale a pena introduzir uma interface `PatientProvider`/`MessagingProvider`
genérica *antes* de existir um terceiro caso real de cada — só formalize a
abstração quando o próximo sistema aparecer, copiando o padrão dos anteriores.

## Deploy

Vercel (`aniversariantes-murex`), branch `main` — push já dispara deploy.
Rotas de API são serverless functions (`ƒ` no output do `next build`); as
páginas sem dependência de dados dinâmicos ficam estáticas (`○`). O cron
declarado em `vercel.json` é criado/atualizado automaticamente a cada deploy.

## Segurança

- Tokens de clínica (e-Clínica, Clinicorp, Helena) ficam só na tabela
  `aniversariantes_clinicas`, lida via `service_role` no backend — nunca
  chegam ao browser. Ficam em **texto plano**: o Clinic Control cifra a mesma
  credencial Helena do lado dele (AES-256-GCM) e a grava aqui em claro. É
  assimetria conhecida, rastreada em
  [Clinic-Control#28](https://github.com/g4bs2006/Clinic-Control/issues/28).
- `GET /api/cron/sync-clinicorp` exige `Authorization: Bearer $CRON_SECRET`
  (a Vercel injeta esse header automaticamente nas chamadas de cron quando a
  env var `CRON_SECRET` está configurada no projeto) — sem isso, qualquer
  request externo pra essa rota é rejeitado com 401.
- `.env.local` é gitignored; `.env.example` só tem placeholders.
- A pasta `captura/` (prints de referência de design) também é gitignored —
  pode conter dados reais de pacientes/conversas.

## Como contribuir

O processo é compartilhado com o Clinic Control — Kanban contínuo por frentes,
trunk-based, conventional commits:
[CONTRIBUTING.md](https://github.com/g4bs2006/Clinic-Control/blob/main/CONTRIBUTING.md).

Duas consequências para este repo:

- **Issues nascem no Clinic-Control**, com a label `app/aniversariantes` — é o
  repo-hub de planejamento, para a fila priorizada ficar num lugar só. O PR nasce
  aqui e é linkado à issue de lá à mão.
- **Fila única:** [Project #1](https://github.com/users/g4bs2006/projects/1).
