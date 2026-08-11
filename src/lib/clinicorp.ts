import type { Clinica, ClinicorpPatient, ClinicorpPatientBirthday } from '@/types/database'

const DEFAULT_BASE_URL = 'https://api.clinicorp.com/rest/v1'

type ClinicorpCreds = Pick<
  Clinica,
  'clinicorp_usuario_api' | 'clinicorp_token_api' | 'clinicorp_subscriber_id' | 'clinicorp_base_url'
>

// Auth da Clinicorp é HTTP Basic (usuário API + token API), não Bearer como a
// e-Clínica — o spec chama o scheme "bearerAuth" mas o `scheme` de fato é
// "basic" (nome enganoso, ver docs/clinicorp-api.md).
function authHeaders(creds: ClinicorpCreds) {
  const basic = Buffer.from(`${creds.clinicorp_usuario_api}:${creds.clinicorp_token_api}`).toString('base64')
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Basic ${basic}`,
  }
}

async function unwrap<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Clinicorp (${label}) respondeu ${res.status}: ${body}`)
  }
  return res.json()
}

// GET /patient/birthdays — aniversariantes de UM dia específico. Não existe
// filtro por mês na Clinicorp (ver docs/clinicorp-api.md); reconstruir "o
// mês" é responsabilidade de quem chama (o cron de sync), não deste cliente.
export async function listBirthdaysByDate(
  clinica: ClinicorpCreds,
  date: string // "YYYY-MM-DD"
): Promise<ClinicorpPatientBirthday[]> {
  const baseUrl = clinica.clinicorp_base_url || DEFAULT_BASE_URL
  const params = new URLSearchParams({
    subscriber_id: clinica.clinicorp_subscriber_id ?? '',
    date,
  })
  const res = await fetch(`${baseUrl}/patient/birthdays?${params.toString()}`, {
    headers: authHeaders(clinica),
    cache: 'no-store',
  })
  return unwrap<ClinicorpPatientBirthday[]>(res, `aniversariantes de ${date}`)
}

// GET /patient/get — só aqui vem o Status (ACTIVE/INACTIVE/DELETED). Usado
// pelo cron pra enriquecer o cache, nunca no caminho de request da tela (ver
// README > Adicionando outros sistemas / limitações da Clinicorp).
export async function getPatient(
  clinica: ClinicorpCreds,
  patientId: number | string
): Promise<ClinicorpPatient> {
  const baseUrl = clinica.clinicorp_base_url || DEFAULT_BASE_URL
  const params = new URLSearchParams({
    subscriber_id: clinica.clinicorp_subscriber_id ?? '',
    PatientId: String(patientId),
  })
  const res = await fetch(`${baseUrl}/patient/get?${params.toString()}`, {
    headers: authHeaders(clinica),
    cache: 'no-store',
  })
  return unwrap<ClinicorpPatient>(res, `paciente ${patientId}`)
}
