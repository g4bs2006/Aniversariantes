import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { requireClinicaSlug } from '@/lib/clinica-scope'
import { listTemplates } from '@/lib/helena'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET /api/templates — junta os templates aprovados na Helena com o mapeamento
// salvo no nosso banco, para a clínica do escopo. O `?clinica=` que o frontend
// ainda manda é ignorado (Clinic-Control#74).
export async function GET(request: NextRequest) {
  try {
    const clinica = await getClinicaBySlug(requireClinicaSlug(request))
    const [{ templates: helenaTemplates, filtradoPorTipo }, { data: configs }] = await Promise.all([
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

    return NextResponse.json({ items, clinica_id: clinica.id, filtrado_por_tipo: filtradoPorTipo })
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: (err as Error).message }, { status })
  }
}

// POST /api/templates — cria ou atualiza o mapeamento de um template na clínica
// do escopo. O `clinica_slug` do corpo é ignorado (Clinic-Control#74): era ele
// que permitia gravar mapeamento na clínica de outro.
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { helena_template_id, nome, param_mapping, dia_envio, horario_envio, is_default, ativo } = body

  if (!helena_template_id) {
    return NextResponse.json({ error: 'helena_template_id é obrigatório' }, { status: 400 })
  }

  try {
    const clinica = await getClinicaBySlug(requireClinicaSlug(request))
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
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: (err as Error).message }, { status })
  }
}
