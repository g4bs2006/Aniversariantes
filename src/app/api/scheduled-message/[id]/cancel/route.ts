import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { cancelScheduledMessage } from '@/lib/helena'
import { getSupabaseAdmin } from '@/lib/supabase'

// POST /api/scheduled-message/{envioId}/cancel?clinica=slug
// {id} aqui é o id da nossa linha em aniversariantes_envios (não o id da Helena).
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const slug = request.nextUrl.searchParams.get('clinica')
  if (!slug) {
    return NextResponse.json({ error: 'Parâmetro "clinica" é obrigatório' }, { status: 400 })
  }

  try {
    const clinica = await getClinicaBySlug(slug)
    const supabase = getSupabaseAdmin()

    const { data: envio, error: envioErr } = await supabase
      .from('aniversariantes_envios')
      .select('*')
      .eq('id', id)
      .eq('clinica_id', clinica.id)
      .single()
    if (envioErr || !envio) throw new Error('Envio não encontrado')
    if (!envio.scheduled_message_id) throw new Error('Envio sem mensagem agendada na Helena')

    await cancelScheduledMessage(clinica, envio.scheduled_message_id)

    const { data, error } = await supabase
      .from('aniversariantes_envios')
      .update({ status: 'canceled' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ envio: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
