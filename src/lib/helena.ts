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
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Helena (${label}) respondeu ${res.status}: ${body}`)
  }
  return res.json()
}

export interface HelenaTemplate {
  id: string
  name: string
  type: string
  approved?: boolean
  content?: string
  params?: unknown
}

// GET /chat/v1/template — só modelos de tipo SCHEDULEDMESSAGE e aprovados
// entram como opção pra agendamento de aniversário.
export async function listTemplates(clinica: Pick<Clinica, 'helena_token'>) {
  const params = new URLSearchParams({
    Type: 'SCHEDULEDMESSAGE',
    ApprovedOnly: 'true',
    PageSize: '100',
  })
  const res = await fetch(`${BASE_URL}/chat/v1/template?${params.toString()}`, {
    headers: authHeaders(clinica.helena_token),
    cache: 'no-store',
  })
  const data = await unwrap(res, 'listar templates')
  return (data.items ?? data.results ?? data) as HelenaTemplate[]
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
