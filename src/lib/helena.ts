import type { Clinica } from '@/types/database'

const BASE_URL = 'https://api.wts.chat'

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function unwrap(res: Response, label: string) {
  const body = await res.text().catch(() => '')
  if (!res.ok) {
    // Sem nomear o fornecedor: esta string sobe para a tela da clínica, e a
    // plataforma de mensagens é white label (ver README § Marca).
    throw new Error(`Plataforma de mensagens (${label}) respondeu ${res.status}: ${body}`)
  }
  // Nem toda resposta de sucesso tem corpo: o /cancel responde 200 com corpo
  // vazio, e `res.json()` direto estourava "Unexpected end of JSON input" —
  // um cancelamento que deu certo na Helena virava 500 aqui.
  if (!body.trim()) return null
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

export interface HelenaTemplate {
  id: string
  name: string
  type: string
  status: string // "APPROVED" quando pronto pra uso
  text: string | null
  params?: unknown
}

async function fetchTemplates(token: string, params: URLSearchParams): Promise<HelenaTemplate[]> {
  const res = await fetch(`${BASE_URL}/chat/v1/template?${params.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  })
  const data = await unwrap(res, 'listar templates')
  return (data.items ?? data.results ?? data) as HelenaTemplate[]
}

export interface ListTemplatesResult {
  templates: HelenaTemplate[]
  // false = o filtro por Type=SCHEDULEDMESSAGE voltou vazio nessa conta e caímos
  // de volta pra "só aprovados" (ver nota abaixo) — a tela precisa avisar que
  // não deu pra garantir que os modelos listados são exclusivos de agendamento.
  filtradoPorTipo: boolean
}

// GET /chat/v1/template — só aprovados E do tipo "Mensagens Agendadas".
//
// Nota histórica (2026-08): o campo `type` do objeto retornado às vezes vem
// como "TEMPLATE" em vez de "SCHEDULEDMESSAGE" mesmo pra modelos aprovados e
// usáveis em scheduled-message — isso é o CONTEÚDO do modelo (é um template
// HSM), não a categoria de uso que o filtro `Type` da query seleciona; são
// campos diferentes, então não dá pra usar o `type` da resposta pra validar
// se o filtro funcionou. Por segurança (evitar quebrar clínica que já
// funciona), se o filtro devolver vazio caímos pra "só ApprovedOnly" — mesmo
// comportamento de antes — e sinalizamos isso pro chamador.
export async function listTemplates(
  clinica: Pick<Clinica, 'helena_token'>
): Promise<ListTemplatesResult> {
  const paramsFiltrado = new URLSearchParams({
    ApprovedOnly: 'true',
    Type: 'SCHEDULEDMESSAGE',
    PageSize: '100',
  })
  const filtrado = await fetchTemplates(clinica.helena_token, paramsFiltrado)
  if (filtrado.length > 0) return { templates: filtrado, filtradoPorTipo: true }

  const paramsFallback = new URLSearchParams({ ApprovedOnly: 'true', PageSize: '100' })
  const fallback = await fetchTemplates(clinica.helena_token, paramsFallback)
  return { templates: fallback, filtradoPorTipo: false }
}

export interface CreateScheduledMessageInput {
  to: string
  from?: string | null
  templateId: string
  scheduling: string // ISO 8601 UTC
  templateParams?: Record<string, string>
}

// POST /chat/v1/scheduled-message
export async function createScheduledMessage(
  clinica: Pick<Clinica, 'helena_token' | 'helena_from'>,
  input: CreateScheduledMessageInput
) {
  const res = await fetch(`${BASE_URL}/chat/v1/scheduled-message`, {
    method: 'POST',
    headers: authHeaders(clinica.helena_token),
    body: JSON.stringify({
      to: input.to,
      from: input.from ?? clinica.helena_from ?? null,
      type: 'TEMPLATE',
      templateId: input.templateId,
      scheduling: input.scheduling,
      templateParams: input.templateParams ?? {},
    }),
  })
  return unwrap(res, 'criar mensagem agendada')
}

// GET /chat/v1/scheduled-message/{id}
export async function getScheduledMessage(
  clinica: Pick<Clinica, 'helena_token'>,
  id: string
) {
  const res = await fetch(`${BASE_URL}/chat/v1/scheduled-message/${id}`, {
    headers: authHeaders(clinica.helena_token),
    cache: 'no-store',
  })
  return unwrap(res, 'obter mensagem agendada')
}

// POST /chat/v1/scheduled-message/{id}/cancel
export async function cancelScheduledMessage(
  clinica: Pick<Clinica, 'helena_token'>,
  id: string
) {
  const res = await fetch(`${BASE_URL}/chat/v1/scheduled-message/${id}/cancel`, {
    method: 'POST',
    headers: authHeaders(clinica.helena_token),
  })
  return unwrap(res, 'cancelar mensagem agendada')
}
