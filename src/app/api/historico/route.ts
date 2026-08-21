import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { requireClinicaSlug } from '@/lib/clinica-scope'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/historico — lista os envios registrados (qualquer status) da clínica
// do escopo. O `?clinica=` que o frontend ainda manda é ignorado: quem decide é
// o token verificado no proxy (Clinic-Control#74).
export async function GET(request: NextRequest) {
  try {
    const clinica = await getClinicaBySlug(requireClinicaSlug(request))
    const { data, error } = await getSupabaseAdmin()
      .from('aniversariantes_envios')
      .select('*')
      .eq('clinica_id', clinica.id)
      .order('scheduled_for', { ascending: false })

    if (error) throw new Error(error.message)
    return NextResponse.json({ items: data })
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: (err as Error).message }, { status })
  }
}
