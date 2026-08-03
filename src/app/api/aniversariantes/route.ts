import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { listAllClientes } from '@/lib/eclinica'
import { getSupabaseAdmin } from '@/lib/supabase'
import { parseNascimento } from '@/lib/format'
import type { Aniversariante } from '@/types/database'

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

    const items: (Aniversariante & { envio: unknown })[] = []
    for (const cliente of clientes) {
      const nascimento = parseNascimento(cliente.nascimento)
      if (!nascimento) continue // sem data de nascimento não dá pra saber o mês

      if (mes && nascimento.aniversario.split('/')[0] !== mes.padStart(2, '0')) continue

      const id = String(cliente.id)
      items.push({
        id,
        nome: cliente.name,
        telefone: cliente.telefone,
        celular: cliente.celular,
        aniversario: nascimento.aniversario,
        datanascimento: nascimento.datanascimento,
        situacao: cliente.clientesituacao_id ?? '',
        envio: envioPorPaciente.get(id) ?? null,
      })
    }

    return NextResponse.json({ items })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
