import type { Clinica, EClinicaCliente } from '@/types/database'

const DEFAULT_BASE_URL = 'https://eclinica.app/api/v2'

// A API real ignora/quebra com os parâmetros de query documentados
// (`mes`/`mesdia` fazem o backend deles responder 500 — confirmado em
// 2026-08 testando direto). O único jeito que funciona hoje é buscar a
// lista completa de clientes (sem filtro) e filtrar por mês no nosso lado.
// Atenção: essa lista é o cadastro inteiro da clínica (pode ser grande).
export async function listAllClientes(
  clinica: Pick<Clinica, 'eclinica_token' | 'eclinica_base_url'>
): Promise<EClinicaCliente[]> {
  const baseUrl = clinica.eclinica_base_url || DEFAULT_BASE_URL

  const res = await fetch(`${baseUrl}/aniversariantes`, {
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
