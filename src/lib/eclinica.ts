import type { Aniversariante, Clinica } from '@/types/database'

// Base URL confirmada na doc pública: https://efficient.app.br/apidoc
const DEFAULT_BASE_URL = 'https://eclinica.app/api/v2'

export async function listAniversariantes(
  clinica: Pick<Clinica, 'eclinica_token' | 'eclinica_base_url'>,
  opts: { mes?: string; mesdia?: string } = {}
): Promise<Aniversariante[]> {
  const baseUrl = clinica.eclinica_base_url || DEFAULT_BASE_URL
  const params = new URLSearchParams()
  if (opts.mes) params.set('mes', opts.mes)
  if (opts.mesdia) params.set('mesdia', opts.mesdia)

  const res = await fetch(`${baseUrl}/aniversariantes?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${clinica.eclinica_token}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`e-Clínica respondeu ${res.status}: ${body}`)
  }

  return res.json()
}
