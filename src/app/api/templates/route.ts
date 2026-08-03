import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { listTemplates } from '@/lib/helena'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/templates?clinica=slug
// Junta os templates aprovados na Helena com o mapeamento salvo no nosso banco.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('clinica')
  if (!slug) {
    return NextResponse.json({ error: 'Parâmetro "clinica" é obrigatório' }, { status: 400 })
  }

  try {
    const clinica = await getClinicaBySlug(slug)
    const [helenaTemplates, { data: configs }] = await Promise.all([
      listTemplates(clinica),
      getSupabaseAdmin()
        .from('aniversariantes_templates')
        .select('*')
        .eq('clinica_id', clinica.id),
    ])

    const configPorTemplateId = new Map((configs ?? []).map((c) => [c.helena_template_id, c]))

    const items = helenaTemplates.map((t) => ({
      helena_template_id: t.id,
      nome: t.name,
      conteudo: t.text ?? '',
      config: configPorTemplateId.get(t.id) ?? null,
    }))

    return NextResponse.json({ items, clinica_id: clinica.id })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// POST /api/templates — cria ou atualiza o mapeamento de um template
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { clinica_slug, helena_template_id, nome, param_mapping, dia_envio, horario_envio, is_default, ativo } = body

  if (!clinica_slug || !helena_template_id) {
    return NextResponse.json({ error: 'clinica_slug e helena_template_id são obrigatórios' }, { status: 400 })
  }

  try {
    const clinica = await getClinicaBySlug(clinica_slug)
    const supabase = getSupabaseAdmin()

    if (is_default) {
      // Só um template padrão por clínica.
      await supabase
        .from('aniversariantes_templates')
        .update({ is_default: false })
        .eq('clinica_id', clinica.id)
    }

    const { data, error } = await supabase
      .from('aniversariantes_templates')
      .upsert(
        {
          clinica_id: clinica.id,
          helena_template_id,
          nome,
          param_mapping: param_mapping ?? {},
          dia_envio: dia_envio ?? 'aniversario',
          horario_envio: horario_envio ?? '09:00',
          is_default: !!is_default,
          ativo: ativo ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'clinica_id,helena_template_id' }
      )
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ item: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
