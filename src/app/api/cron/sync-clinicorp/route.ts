import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { listBirthdaysByDate, getPatient } from '@/lib/clinicorp'
import { hojeNoTimezone } from '@/lib/format'
import type { Clinica } from '@/types/database'

// Dá margem pra 1 clínica Clinicorp sincronizar dentro do limite de duração
// de function do plano Hobby da Vercel (cron ali só dispara 1x/dia — ver
// vercel.json — então isso já roda fora do caminho de request da tela).
export const maxDuration = 60

const CONCORRENCIA = 6

async function comConcorrenciaLimitada<T, R>(
  items: T[],
  limite: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let proximo = 0
  async function worker() {
    while (proximo < items.length) {
      const idx = proximo++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, worker))
  return results
}

// Dias do mês atual + próximo mês, no fuso da clínica — a Clinicorp só lista
// aniversariantes por dia (ver docs/clinicorp-api.md), então "o mês" só existe
// juntando 1 chamada por dia. Escopo deliberadamente limitado a esses 2 meses:
// é o que a tela de agendamento realmente precisa (aniversário passado não é
// agendável, e não há caso de uso pra navegar meses distantes hoje).
function diasParaSincronizar(timezone: string): string[] {
  const { ano, mes } = hojeNoTimezone(timezone)
  const inicio = Date.UTC(ano, mes - 1, 1)
  const fim = Date.UTC(ano, mes + 1, 0) // último dia do mês seguinte
  const dias: string[] = []
  for (let t = inicio; t <= fim; t += 86_400_000) {
    dias.push(new Date(t).toISOString().slice(0, 10))
  }
  return dias
}

interface PacienteEncontrado {
  patientId: number
  nome: string
  telefone: string | null
  ano: string
  mes: string
  dia: string
}

async function sincronizarClinica(clinica: Clinica) {
  const dias = diasParaSincronizar(clinica.timezone)

  const porDia = await comConcorrenciaLimitada(dias, CONCORRENCIA, async (date) => {
    try {
      return await listBirthdaysByDate(clinica, date)
    } catch (err) {
      return { erro: (err as Error).message, date }
    }
  })

  const erros: string[] = []
  const encontrados = new Map<number, PacienteEncontrado>()
  for (const resultado of porDia) {
    if ('erro' in resultado) {
      erros.push(`birthdays ${resultado.date}: ${resultado.erro}`)
      continue
    }
    for (const p of resultado) {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.BirthDate ?? '')
      if (!match) continue // sem data válida não dá pra saber mês/dia
      const [, ano, mes, dia] = match
      encontrados.set(p.PatientId, {
        patientId: p.PatientId,
        nome: p.Name,
        telefone: p.MobilePhone ?? null,
        ano,
        mes,
        dia,
      })
    }
  }

  const pacientes = [...encontrados.values()]
  const statusPorPaciente = await comConcorrenciaLimitada(pacientes, CONCORRENCIA, async (p) => {
    try {
      const detalhe = await getPatient(clinica, p.patientId)
      return detalhe.Status
    } catch (err) {
      erros.push(`get ${p.patientId}: ${(err as Error).message}`)
      return null // não verificado — a tela trata como informativo, não filtra
    }
  })

  const rows = pacientes.map((p, idx) => ({
    clinica_id: clinica.id,
    paciente_id: String(p.patientId),
    nome: p.nome,
    telefone: p.telefone,
    datanascimento: `${p.ano}-${p.mes}-${p.dia}`,
    mes_aniversario: parseInt(p.mes, 10),
    dia_aniversario: parseInt(p.dia, 10),
    situacao: statusPorPaciente[idx],
  }))

  const supabase = getSupabaseAdmin()
  // Substitui o cache inteiro da clínica: mais simples que reconciliar
  // altas/baixas de pacientes, e o volume (2 meses de aniversariantes) é
  // pequeno o bastante pra não valer a pena um upsert incremental.
  const { error: deleteError } = await supabase
    .from('aniversariantes_pacientes_cache')
    .delete()
    .eq('clinica_id', clinica.id)
  if (deleteError) erros.push(`delete cache: ${deleteError.message}`)

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('aniversariantes_pacientes_cache').insert(rows)
    if (insertError) erros.push(`insert cache: ${insertError.message}`)
  }

  return { clinica: clinica.slug, dias: dias.length, pacientes: rows.length, erros }
}

// GET /api/cron/sync-clinicorp — chamado 1x/dia pelo Vercel Cron (vercel.json).
// A Vercel injeta `Authorization: Bearer $CRON_SECRET` nessas chamadas quando
// a env var CRON_SECRET está configurada; rejeitamos qualquer outra origem.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET

  // Segredo AUSENTE e segredo ERRADO eram a mesma resposta (401), e isso custou
  // 9 dias de sync parado sem ninguém notar: a env var nunca foi cadastrada na
  // Vercel (só no .env.local), então a rota rejeitava a própria Vercel, e o log
  // mostrava "Não autorizado" — indistinguível de alguém batendo na URL.
  //
  // 503 separa as duas coisas: é o app dizendo que ele não está configurado, não
  // que o chamador não tem direito. Sem revelar qual variável falta, porque quem
  // chama aqui não é autenticado.
  if (!secret) {
    console.error(
      '[cron/sync-clinicorp] CRON_SECRET ausente — a rota rejeita TODA chamada, ' +
        'inclusive a do Vercel Cron. Cadastrar em Project Settings > Environment ' +
        'Variables (o .env.local não vale em produção).',
    )
    return NextResponse.json({ error: 'Cron não configurado' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: clinicas, error } = await getSupabaseAdmin()
    .from('aniversariantes_clinicas')
    .select('*')
    .eq('sistema_prontuario', 'clinicorp')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const resultados = []
  for (const clinica of (clinicas ?? []) as Clinica[]) {
    resultados.push(await sincronizarClinica(clinica))
  }

  return NextResponse.json({ ok: true, resultados })
}
