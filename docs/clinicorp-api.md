# API Clinicorp — estudo pra substituir/complementar a e-Clínica

Levantamento feito em 2026-08-11, a partir do Swagger UI publicado em
`https://sistema.clinicorp.com/api-docs/#/patient/get_patient_birthdays`.

## Como o spec foi obtido

O Swagger UI dessa página não expõe um `swagger.json` estático — o spec
completo (OpenAPI 3.0.1) vem embutido inline em
`https://sistema.clinicorp.com/api-docs/swagger-ui-init.js`, dentro de
`options.swaggerDoc`. Baixar esse arquivo e ler o JSON é o jeito de obter o
spec inteiro sem depender do JS do Swagger renderizar a UI.

- Título: **API Clinicorp**, versão `1.0.0`
- Servers documentados:
  - `https://api.clinicorp.com/rest/v1`
  - `{url}/rest/v1` (variável `url`, default `https://api.clinicorp.com`)

## Autenticação

Diferente da e-Clínica (Bearer token simples), a Clinicorp usa **HTTP Basic
Auth** (o scheme no spec se chama `bearerAuth`, mas `"scheme": "basic"` —
nome enganoso):

- **Username** = ID de acesso ao Sistema
- **Password** = Token API

Como obter (segundo a descrição do próprio spec): login no sistema →
"Gerenciar Assinatura" → "Acesso Externo e Integrações" → campos **Usuário
API** (username) e **Token API** (password).

Toda rota também exige o parâmetro de query `subscriber_id` (id do
Assinante/clínica) — ou seja, um único usuário/token Clinicorp pode
enxergar mais de um assinante, e cada chamada precisa dizer qual.

## Endpoint principal: `GET /patient/birthdays`

Lista os pacientes aniversariantes **de um dia específico** (não de um mês).

**Tag:** `patient`

### Query params

| Nome | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `subscriber_id` | string | ✅ | id do Assinante |
| `date` | string `YYYY-MM-DD` | opcional | Data para buscar aniversariantes. Se omitido, usa a data atual |

### Resposta `200` — array de objetos

```jsonc
[
  {
    "PatientId": 123,           // integer
    "Name": "Nome do Paciente", // string
    "BirthDate": "1990-05-20",  // string, format: date
    "Age": 36,                  // integer
    "Email": "paciente@x.com",  // string
    "MobilePhone": "4499990000",// string
    "OtherDocumentId": "..."    // string — CPF
  }
]
```

### Resposta `400`

`$ref: #/components/responses/NotFound` → schema `Error`:
```jsonc
{ "Error": 1, "Message": "Parâmetro obrigatório não informado" }
```

Não há um `401` documentado especificamente nesse endpoint (só existe um
response genérico `Unauthorized` nos `components`, usado em outras rotas do
spec).

## Endpoints relacionados (tag `patient`) também mapeados

Só pra registrar o que existe ao redor, já que pode ser útil depois:

- **`GET /patient/get`** — busca **um** paciente específico por
  `PatientId`, `Name`, `OtherDocumentId`, `Phone` ou `Email` (todos opcionais,
  além do `subscriber_id` obrigatório). Retorna `PatientId`, `Name`, `Email`,
  `Phone`, `OtherDocumentId`, `BirthDate` **e `Status`**
  (`ACTIVE` / `INACTIVE` / `DELETED`) — o único lugar onde vi status do
  paciente documentado nessa tag.
- **`POST /patient/create`** — cria paciente (`Name`, `BirthDate`, `Sex`,
  `Email`, `MobilePhone`, `DocumentId`, `OtherDocumentId`, `Notes`,
  flags `IgnoreSameName`/`IgnoreSameDoc`).
- **`GET /patient/list_appointments`** — agendamentos de um paciente
  (`PatientId`), não relevante pra fluxo de aniversário.
- **`GET /patient/list_estimates`** — soma de orçamentos num período
  (`subscriber_id`, `from`, `to`), não relevante aqui.

**Não existe** (pelo menos não na tag `patient`) um endpoint de listagem
geral de pacientes por mês/intervalo, nem um "list all patients". A busca é
sempre por um paciente específico (`/patient/get`) ou por aniversariantes de
**um dia** (`/patient/birthdays`).

## Comparação com a e-Clínica (pontos que afetam o design da integração)

| Aspecto | e-Clínica (atual) | Clinicorp |
|---|---|---|
| Auth | Bearer token | HTTP Basic (usuário + token API) + `subscriber_id` obrigatório por request |
| Filtro por mês | Quebra o backend (500); buscamos tudo e filtramos no nosso lado | Não existe filtro por mês — só `date` (um dia). Pra reconstruir "aniversariantes do mês" seria necessário 1 chamada por dia do mês (até 31 requests), ou repensar a UI pra granularidade de dia |
| Status do paciente | `situacao`/`clientesituacao_id` (texto livre, ex. `INATIVO`, `ARQUIVO MORTO`) vem direto na listagem | **Não vem** em `/patient/birthdays`. Só existe em `/patient/get` (busca individual, `ACTIVE`/`INACTIVE`/`DELETED`) — filtrar por status exigiria 1 chamada extra por paciente (N+1) |
| Shape da resposta | Instável (2 formatos alternando, datas sentinela `0000-00-00`) | Aparenta ser estável e tipado no spec (não testado em produção ainda) |
| Telefone | Dois campos (`telefone`, `celular`), sujos (formato inconsistente) | Um único campo `MobilePhone`; formato não garantido pelo spec — provavelmente ainda vai precisar de normalização tipo `toE164BR` |
| Paginação | Nenhuma; lista completa sempre | Não aplicável — cada request já é escopada (1 paciente ou 1 dia) |

## Perguntas abertas / próximos passos

1. **Testar o endpoint de verdade** (com credenciais reais de uma clínica
   Clinicorp) pra confirmar se o shape do spec bate com a resposta real —
   a experiência com a e-Clínica mostra que a doc pública pode divergir do
   comportamento em produção.
2. **Decidir a estratégia pra granularidade "mês"**: loop de `date` por
   todos os dias do mês (até 31 chamadas) é o único jeito com o que existe
   hoje na tag `patient`. Vale confirmar se não há outro endpoint (fora da
   tag `patient`) que ajude — não explorei o spec completo, só a área de
   pacientes.
3. **Decidir se/como filtrar paciente inativo** dado que exigiria uma
   chamada `/patient/get` por paciente (N+1) — ou aceitar todos os
   aniversariantes retornados sem esse filtro.
4. Confirmar limites de rate/paginação — nada documentado no spec sobre
   isso.
