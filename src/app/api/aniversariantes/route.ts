import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { listAniversariantes } from '@/lib/eclinica'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('clinica')
  const mes = searchParams.get('mes') ?? undefined

  if (!slug) {
    return NextResponse.json({ error: 'Parâmetro "clinica" é obrigatório' }, { status: 400 })
  }

  try {
    const clinica = await getClinicaBySlug(slug)
    const aniversariantes = await listAniversariantes(clinica, { mes })

    const anoAtual = new Date().getFullYear()
    const { data: envios } = await getSupabaseAdmin()
      .from('aniversariantes_envios')
      .select('paciente_id_eclinica, status, scheduled_for, scheduled_message_id')
      .eq('clinica_id', clinica.id)
      .eq('ano', anoAtual)

    const envioPorPaciente = new Map(
      (envios ?? []).map((e) => [e.paciente_id_eclinica, e])
    )

    const items = aniversariantes
      .filter((a) => a.situacao === 'ATIVO')
      .map((a) => ({
        ...a,
        envio: envioPorPaciente.get(a.id) ?? null,
      }))

    return NextResponse.json({ items })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
