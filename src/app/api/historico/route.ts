import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/historico?clinica=slug — lista os envios registrados (qualquer status)
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('clinica')
  if (!slug) {
    return NextResponse.json({ error: 'Parâmetro "clinica" é obrigatório' }, { status: 400 })
  }

  try {
    const clinica = await getClinicaBySlug(slug)
    const { data, error } = await getSupabaseAdmin()
      .from('aniversariantes_envios')
      .select('*')
      .eq('clinica_id', clinica.id)
      .order('scheduled_for', { ascending: false })

    if (error) throw new Error(error.message)
    return NextResponse.json({ items: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
