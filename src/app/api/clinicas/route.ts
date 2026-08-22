import { NextRequest, NextResponse } from 'next/server'
import { getClinicaPublicaBySlug, ClinicaNaoProvisionadaError } from '@/lib/clinicas'
import { requireClinicaSlug } from '@/lib/clinica-scope'

// GET /api/clinicas — devolve SÓ a clínica do escopo do token, não a lista.
//
// O nome plural e o formato de array ficaram para o `ClinicaProvider` não
// precisar mudar: com um único item, o `ClinicaSwitcher` já cai sozinho no
// caminho de nome fixo em vez de dropdown (ver o `clinicas.length === 1` lá).
// Antes esta rota enumerava todas as clínicas cadastradas, sem autenticação.
export async function GET(request: NextRequest) {
  try {
    const clinica = await getClinicaPublicaBySlug(requireClinicaSlug(request))
    return NextResponse.json({ clinicas: [clinica] })
  } catch (err) {
    // Token válido para uma clínica que ainda não foi provisionada é caminho
    // NORMAL, não falha: o link da aba da Helena pode ser configurado antes do
    // provisionamento. Devolve 404 com código para o frontend mostrar a tela
    // certa em vez de "erro ao carregar", que culpa quem não pode consertar.
    if (err instanceof ClinicaNaoProvisionadaError) {
      return NextResponse.json(
        { error: err.message, code: err.code, slug: err.slug },
        { status: err.status },
      )
    }
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: (err as Error).message }, { status })
  }
}
