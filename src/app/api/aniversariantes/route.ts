import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { listAllClientes } from '@/lib/eclinica'
import { getSupabaseAdmin } from '@/lib/supabase'
import { parseDataYMD, parseAniversarioPronto, parseAniversarioMonthDay, aniversarioJaPassou } from '@/lib/format'
import type { Aniversariante } from '@/types/database'

// `situacao`/`clientesituacao_id` é uma etiqueta livre do CRM da clínica, não
// um enum — mas esses dois valores claramente indicam paciente que não deve
// mais receber mensagem (cadastro morto/inativo).
const SITUACOES_EXCLUIDAS = new Set(['INATIVO', 'ARQUIVO MORTO'])

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('clinica')
  const mes = searchParams.get('mes') ?? undefined

  if (!slug) {
    return NextResponse.json({ error: 'Parâmetro "clinica" é obrigatório' }, { status: 400 })
  }

  try {
    const clinica = await getClinicaBySlug(slug)
    // A API e-Clínica quebra (500) com os parâmetros de filtro por mês —
    // buscamos o cadastro inteiro e filtramos aqui.
    const clientes = await listAllClientes(clinica)

    const anoAtual = new Date().getFullYear()
    const { data: envios } = await getSupabaseAdmin()
      .from('aniversariantes_envios')
      .select('paciente_id_eclinica, status, scheduled_for, scheduled_message_id')
      .eq('clinica_id', clinica.id)
      .eq('ano', anoAtual)

    const envioPorPaciente = new Map(
      (envios ?? []).map((e) => [String(e.paciente_id_eclinica), e])
    )

    const items: (Aniversariante & { envio: unknown; ja_passou: boolean })[] = []
    for (const cliente of clientes) {
      // Shape instável: tenta data completa (datanascimento ou nascimento),
      // cai pro aniversario "MM/DD" pronto se for tudo que tiver.
      const data =
        parseDataYMD(cliente.datanascimento) ??
        parseDataYMD(cliente.nascimento) ??
        parseAniversarioPronto(cliente.aniversario)
      if (!data) continue // sem data válida não dá pra saber o mês

      if (mes && data.aniversario.split('/')[0] !== mes.padStart(2, '0')) continue

      const situacao = cliente.situacao ?? cliente.clientesituacao_id ?? ''
      if (SITUACOES_EXCLUIDAS.has(situacao.toUpperCase())) continue

      const id = String(cliente.id)
      const { mes: mesAniv, dia: diaAniv } = parseAniversarioMonthDay(data.aniversario)
      items.push({
        id,
        // Aniversário anterior a hoje não é agendável — o envio só faz sentido
        // de hoje pra frente (antes ia parar no ano seguinte silenciosamente).
        ja_passou: aniversarioJaPassou(mesAniv, diaAniv, clinica.timezone),
        nome: cliente.nome ?? cliente.name ?? '(sem nome)',
        telefone: cliente.telefone,
        celular: cliente.celular,
        aniversario: data.aniversario,
        datanascimento: data.datanascimento ?? '',
        situacao,
        envio: envioPorPaciente.get(id) ?? null,
      })
    }

    return NextResponse.json({ items })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
