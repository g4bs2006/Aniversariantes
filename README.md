# Aniversariantes

Painel embutido na Helena (aba/iframe dentro da plataforma da clínica) para
gerenciar mensagens automáticas de aniversário de pacientes: lista quem faz
aniversário no mês, agenda o envio de um template aprovado no WhatsApp e
acompanha o histórico de envios/cancelamentos.

Hoje roda só pra **Oral Foz**, mas o schema e o código já são multi-clínica —
ver [Multi-clínica](#multi-clínica) e [Adicionando outros sistemas](#adicionando-outros-sistemas-ehrpms-e-mensageria).

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS 4
- Supabase (projeto **Clinic Control**, `jggfnfxdtfqeqyvxufgu`, schema `public`,
  tabelas prefixadas `aniversariantes_*` pra não colidir com o resto do projeto)
- Integrações externas atuais:
  - **e-Clínica** (`https://eclinica.app/api/v2`) — sistema de prontuário/CRM
    da clínica, origem dos dados de aniversariantes
  - **Helena / wts.chat** (`https://api.wts.chat`) — templates de WhatsApp
    aprovados e agendamento de mensagens

## Estrutura

```
src/
├── app/
│   ├── api/                        # rotas server-side (únicas com acesso a tokens/service role)
│   │   ├── clinicas/               # GET  lista clínicas cadastradas
│   │   ├── aniversariantes/        # GET  aniversariantes do mês (cruza e-Clínica + nosso histórico)
│   │   ├── templates/              # GET  templates aprovados + config salva / POST salva mapeamento
│   │   ├── scheduled-message/      # POST agenda envio
│   │   │   └── [id]/cancel/        # POST cancela (id = linha em aniversariantes_envios)
│   │   └── historico/              # GET  lista todos os envios da clínica
│   ├── page.tsx                    # tela Aniversariantes
│   ├── modelos/page.tsx             # tela Modelos de mensagem
│   └── historico/page.tsx           # tela Histórico
├── components/                     # Views (client components) + AppShell + ui/ (Button, Badge, Modal)
├── lib/
│   ├── eclinica.ts                 # cliente do sistema de prontuário (hoje: e-Clínica)
│   ├── helena.ts                   # cliente do sistema de mensageria (hoje: Helena)
│   ├── clinicas.ts                 # lookup de clínica por slug (credenciais)
│   ├── supabase.ts                 # client admin (service role)
│   ├── constants.ts                # CLINICA_SLUG fixo = 'oral-foz' (ver Multi-clínica)
│   └── format.ts                   # normalização de telefone/data, cálculo de próxima ocorrência
└── types/
    ├── database.ts                 # tipos de domínio (Clinica, Aniversariante, Envio, TemplateConfig...)
    └── supabase.ts                 # Database (schema tipado do supabase-js)
```

## Setup

1. `npm install`
2. Copiar `.env.example` para `.env.local` e preencher:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Supabase Dashboard → Clinic Control →
     Settings → API → `service_role` — **nunca** commitar esse valor)
3. Rodar as migrations em `supabase/migrations/` (criam as tabelas; a seed de
   clínica real fica de fora do arquivo versionado — ver comentário no topo
   da migration)
4. `npm run dev`

Na Vercel, as mesmas 3 variáveis precisam estar cadastradas em Project
Settings → Environment Variables (o `.env.local` só vale local).

## Modelo de dados (Supabase · `public`)

| Tabela | O que guarda |
|---|---|
| `aniversariantes_clinicas` | 1 linha por clínica: `slug`, `nome`, credenciais (`eclinica_token`, `eclinica_base_url`, `helena_token`, `helena_channel_id`, `helena_from`), `timezone` |
| `aniversariantes_templates` | mapeamento de variáveis de um template Helena pros campos do paciente (`param_mapping`), dia/horário padrão de envio, qual é o template padrão |
| `aniversariantes_envios` | histórico de agendamentos: paciente, template usado, `scheduled_message_id` (id na Helena), status, data agendada. Chave única `(clinica_id, paciente_id_eclinica, ano)` — evita agendar parabéns duplicado no mesmo ano |

RLS habilitada sem policies (deny-all) em todas — acesso só via
`service_role` no backend, mesmo padrão do Contact-Calendar.

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

- **O parâmetro de query `Type` do `GET /chat/v1/template` não corresponde
  ao campo `type` do objeto retornado.** Templates HSM comuns (inclusive
  aprovados e usáveis em `scheduled-message`) vêm com `type: "TEMPLATE"`, não
  `"SCHEDULEDMESSAGE"` como o enum documentado sugere. Por isso filtramos só
  por `ApprovedOnly=true`.
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

O banco já suporta múltiplas clínicas (`aniversariantes_clinicas`, uma linha
por clínica com suas próprias credenciais) e todas as rotas de API recebem
`?clinica=<slug>`. O frontend, porém, está **travado na Oral Foz** por
decisão de escopo — `src/lib/constants.ts` exporta `CLINICA_SLUG = 'oral-foz'`
e os componentes usam essa constante em vez de um seletor de clínica.

Pra reativar multi-clínica no frontend:
1. Reverter `CLINICA_SLUG` pra vir de um seletor (existiu antes como
   `ClinicaSwitcher` + `useClinicas`, lendo/escrevendo `?clinica=` na URL —
   ver histórico do git se quiser recuperar o componente).
2. Inserir uma linha por clínica nova em `aniversariantes_clinicas` com
   `slug`, `nome`, `eclinica_token`, `helena_token` (e `eclinica_base_url`
   se a clínica não usar a mesma instância da e-Clínica).

## Adicionando outros sistemas (EHR/PMS e mensageria)

O projeto assume hoje **um** provedor de prontuário (e-Clínica) e **um**
provedor de mensageria (Helena) — não existe uma interface formal de
"provider" no código, é módulo concreto mesmo. Se/quando uma clínica usar
outro sistema (ex: Clinicorp, usado por outras clínicas do mesmo grupo — ver
`02_Projetos/clinicorp-api-docs/`), o caminho mais simples é:

**Novo provedor de prontuário:**
1. Criar `src/lib/<sistema>.ts` com uma função que recebe as credenciais da
   clínica e devolve os dados brutos do sistema (sem se preocupar em bater
   exatamente com `EClinicaCliente` — cada API tem seu próprio shape).
2. Adaptar (ou criar uma variante de) `src/app/api/aniversariantes/route.ts`
   pra normalizar esse shape novo no formato `Aniversariante` já usado por
   toda a UI (`id`, `nome`, `telefone`, `celular`, `aniversario` "MM/DD",
   `datanascimento` "DD/MM/AAAA", `situacao`) — esse é o contrato que
   `AniversariantesView`, `ScheduleModal` etc. esperam, então normalizar aqui
   evita tocar em componente de tela.
3. Adicionar uma coluna `sistema_prontuario` (ou similar) em
   `aniversariantes_clinicas` pra rotear qual cliente usar por clínica, e um
   `switch`/lookup no início da rota.

**Novo provedor de mensageria:**
1. Criar `src/lib/<provedor>.ts` espelhando as 3 funções de `lib/helena.ts`:
   listar templates aprovados, criar mensagem agendada, cancelar mensagem
   agendada. Mesma ideia: a assinatura pode ser diferente, o que importa é
   `src/app/api/templates/route.ts` e `src/app/api/scheduled-message/*`
   devolverem o mesmo formato de resposta que o frontend já consome.
2. Adicionar coluna `sistema_mensageria` em `aniversariantes_clinicas`.

Não vale a pena introduzir uma interface `PatientProvider`/`MessagingProvider`
genérica *antes* de existir um segundo caso real de cada — só formalize a
abstração quando o segundo sistema aparecer, copiando o padrão do primeiro.

## Deploy

Vercel (`aniversariantes-murex`), branch `main` — push já dispara deploy.
Rotas de API são serverless functions (`ƒ` no output do `next build`); as
páginas sem dependência de dados dinâmicos ficam estáticas (`○`).

## Segurança

- Tokens de clínica (e-Clínica, Helena) ficam só na tabela
  `aniversariantes_clinicas`, lida via `service_role` no backend — nunca
  chegam ao browser.
- `.env.local` é gitignored; `.env.example` só tem placeholders.
- A pasta `captura/` (prints de referência de design) também é gitignored —
  pode conter dados reais de pacientes/conversas.
