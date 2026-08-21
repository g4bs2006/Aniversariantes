import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { requireClinicaSlug } from '@/lib/clinica-scope'
import { createScheduledMessage } from '@/lib/helena'
import { getSupabaseAdmin } from '@/lib/supabase'
import { toE164BR, parseAniversarioMonthDay, nextOccurrence, aniversarioParaExibicao } from '@/lib/format'
import type { Aniversariante, TemplateConfig } from '@/types/database'

interface CreateBody {
  template_id: string // id da linha aniversariantes_templates
  paciente: Aniversariante
  scheduling_override?: string // ISO — se o usuário editou a data/hora no modal
}

// POST /api/scheduled-message — agenda o parabéns de um aniversariante na
// clínica do escopo. O `clinica_slug` do corpo é ignorado (Clinic-Control#74):
// era ele que permitia disparar WhatsApp em nome de outra clínica, com o token
// Helena dela.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateBody
  const { template_id, paciente, scheduling_override } = body

  if (!template_id || !paciente) {
    return NextResponse.json({ error: 'template_id e paciente são obrigatórios' }, { status: 400 })
  }

  try {
    const clinica = await getClinicaBySlug(requireClinicaSlug(request))
    const supabase = getSupabaseAdmin()

    // O filtro por `clinica_id` não estava aqui: bastava mandar o id de um
    // template de outra clínica para usá-lo com as credenciais desta. Escopar
    // a busca é o que transforma "não encontrado" na resposta certa.
    const { data: template, error: templateErr } = await supabase
      .from('aniversariantes_templates')
      .select('*')
      .eq('id', template_id)
      .eq('clinica_id', clinica.id)
      .single<TemplateConfig>()
    if (templateErr || !template) throw new Error('Modelo de mensagem não encontrado')

    const telefone = toE164BR(paciente.celular || paciente.telefone || '')
    if (!telefone) throw new Error(`Telefone inválido para ${paciente.nome}`)

    const anoAtual = new Date().getFullYear()

    let scheduling: string
    if (scheduling_override) {
      // Data escolhida à mão no modal — ainda assim não pode ser no passado,
      // a Helena rejeita e o envio nunca aconteceria.
      if (new Date(scheduling_override).getTime() <= Date.now()) {
        throw new Error('A data e hora do envio precisam estar no futuro')
      }
      scheduling = scheduling_override
    } else {
      const { mes, dia } = parseAniversarioMonthDay(paciente.aniversario)
      const ocorrencia = nextOccurrence(mes, dia, clinica.timezone, template.horario_envio)
      if (!ocorrencia) {
        throw new Error(
          `O aniversário de ${paciente.nome} (${aniversarioParaExibicao(paciente.aniversario)}) já passou este ano`
        )
      }
      scheduling = ocorrencia.toISOString()
    }

    const templateParams: Record<string, string> = {}
    for (const [param, field] of Object.entries(template.param_mapping)) {
      const source: Record<string, string> = {
        nome: paciente.nome,
        primeiro_nome: paciente.nome.split(' ')[0],
        data_nascimento: paciente.datanascimento,
        aniversario: aniversarioParaExibicao(paciente.aniversario),
      }
      templateParams[param] = source[field] ?? ''
    }

    const created = await createScheduledMessage(clinica, {
      to: telefone,
      templateId: template.helena_template_id,
      scheduling,
      templateParams,
    })

    const scheduledMessageId = created?.id ?? created?.scheduledMessageId ?? null

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
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: (err as Error).message }, { status })
  }
}
