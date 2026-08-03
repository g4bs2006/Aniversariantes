import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { createScheduledMessage } from '@/lib/helena'
import { getSupabaseAdmin } from '@/lib/supabase'
import { toE164BR, parseAniversarioMonthDay, nextOccurrence } from '@/lib/format'
import type { Aniversariante, TemplateConfig } from '@/types/database'

interface CreateBody {
  clinica_slug: string
  template_id: string // id da linha aniversariantes_templates
  paciente: Aniversariante
  scheduling_override?: string // ISO — se o usuário editou a data/hora no modal
}

// POST /api/scheduled-message — agenda o parabéns de um aniversariante
export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateBody
  const { clinica_slug, template_id, paciente, scheduling_override } = body

  if (!clinica_slug || !template_id || !paciente) {
    return NextResponse.json({ error: 'clinica_slug, template_id e paciente são obrigatórios' }, { status: 400 })
  }

  try {
    const clinica = await getClinicaBySlug(clinica_slug)
    const supabase = getSupabaseAdmin()

    const { data: template, error: templateErr } = await supabase
      .from('aniversariantes_templates')
      .select('*')
      .eq('id', template_id)
      .single<TemplateConfig>()
    if (templateErr || !template) throw new Error('Modelo de mensagem não encontrado')

    const telefone = toE164BR(paciente.celular || paciente.telefone)
    if (!telefone) throw new Error(`Telefone inválido para ${paciente.nome}`)

    const anoAtual = new Date().getFullYear()

    let scheduling = scheduling_override
    if (!scheduling) {
      const { mes, dia } = parseAniversarioMonthDay(paciente.aniversario)
      scheduling = nextOccurrence(mes, dia, clinica.timezone, template.horario_envio).toISOString()
    }

    const templateParams: Record<string, string> = {}
    for (const [param, field] of Object.entries(template.param_mapping)) {
      const source: Record<string, string> = {
        nome: paciente.nome,
        primeiro_nome: paciente.nome.split(' ')[0],
        data_nascimento: paciente.datanascimento,
        aniversario: paciente.aniversario,
      }
      templateParams[param] = source[field] ?? ''
    }

    const created = await createScheduledMessage(clinica, {
      to: telefone,
      templateId: template.helena_template_id,
      scheduling,
      templateParams,
    })

    const scheduledMessageId = created.id ?? created.scheduledMessageId ?? null

    const { data: envio, error: envioErr } = await supabase
      .from('aniversariantes_envios')
      .upsert(
        {
          clinica_id: clinica.id,
          template_id: template.id,
          paciente_id_eclinica: paciente.id,
          paciente_nome: paciente.nome,
          paciente_telefone: telefone,
          data_nascimento: paciente.datanascimento,
          ano: anoAtual,
          scheduled_message_id: scheduledMessageId,
          status: 'scheduled',
          scheduled_for: scheduling,
        },
        { onConflict: 'clinica_id,paciente_id_eclinica,ano' }
      )
      .select()
      .single()

    if (envioErr) throw new Error(envioErr.message)

    return NextResponse.json({ envio, helena_response: created })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
