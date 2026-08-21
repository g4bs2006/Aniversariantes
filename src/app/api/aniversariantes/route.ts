import { NextRequest, NextResponse } from 'next/server'
import { getClinicaBySlug } from '@/lib/clinicas'
import { requireClinicaSlug } from '@/lib/clinica-scope'
import { listAllClientes } from '@/lib/eclinica'
import { getSupabaseAdmin } from '@/lib/supabase'
import { parseDataYMD, parseAniversarioPronto, parseAniversarioMonthDay, aniversarioJaPassou } from '@/lib/format'
import type { Aniversariante, Clinica, PacienteCache } from '@/types/database'

// `situacao`/`clientesituacao_id` é uma etiqueta livre do CRM da clínica, não
// um enum — mas esses dois valores claramente indicam paciente que não deve
// mais receber mensagem (cadastro morto/inativo).
const SITUACOES_EXCLUIDAS_ECLINICA = new Set(['INATIVO', 'ARQUIVO MORTO'])

// Status vindo do cache Clinicorp (ver /patient/get em docs/clinicorp-api.md).
// `null` (não verificado, ex: get falhou no sync) não é filtrado — mesmo
// espírito informativo da e-Clínica.
const SITUACOES_EXCLUIDAS_CLINICORP = new Set(['INACTIVE', 'DELETED'])

type Item = Aniversariante & { envio: unknown; ja_passou: boolean }

function montarItem(
  base: { id: string; nome: string; telefone: string | null; celular: string | null; mes: number; dia: number; datanascimento: string; situacao: string },
  clinica: Pick<Clinica, 'timezone'>,
  envioPorPaciente: Map<string, unknown>
): Item {
  return {
    id: base.id,
    nome: base.nome,
    telefone: base.telefone,
    celular: base.celular,
    aniversario: `${String(base.mes).padStart(2, '0')}/${String(base.dia).padStart(2, '0')}`,
    datanascimento: base.datanascimento,
    situacao: base.situacao,
    // Aniversário anterior a hoje não é agendável — o envio só faz sentido de
    // hoje pra frente (antes ia parar no ano seguinte silenciosamente).
    ja_passou: aniversarioJaPassou(base.mes, base.dia, clinica.timezone),
    envio: envioPorPaciente.get(base.id) ?? null,
  }
}

async function buscarDaEClinica(clinica: Clinica, mes: string | undefined, envioPorPaciente: Map<string, unknown>) {
  // A API e-Clínica quebra (500) com os parâmetros de filtro por mês —
  // buscamos o cadastro inteiro e filtramos aqui.
  const clientes = await listAllClientes(clinica)

  const items: Item[] = []
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
    if (SITUACOES_EXCLUIDAS_ECLINICA.has(situacao.toUpperCase())) continue

    const { mes: mesAniv, dia: diaAniv } = parseAniversarioMonthDay(data.aniversario)
    items.push(
      montarItem(
        {
          id: String(cliente.id),
          nome: cliente.nome ?? cliente.name ?? '(sem nome)',
          telefone: cliente.telefone,
          celular: cliente.celular,
          mes: mesAniv,
          dia: diaAniv,
          datanascimento: data.datanascimento ?? '',
          situacao,
        },
        clinica,
        envioPorPaciente
      )
    )
  }
  return items
}

// Clinicorp não tem endpoint de listagem por mês — o cron de sync
// (src/app/api/cron/sync-clinicorp) já resolveu isso de antemão, gravando o
// mês atual + o seguinte em aniversariantes_pacientes_cache. Aqui é só 1
// query, nada de chamada à API da Clinicorp no caminho da tela.
async function buscarDoCacheClinicorp(clinica: Clinica, mes: string | undefined, envioPorPaciente: Map<string, unknown>) {
  let query = getSupabaseAdmin()
    .from('aniversariantes_pacientes_cache')
    .select('*')
    .eq('clinica_id', clinica.id)

  if (mes) query = query.eq('mes_aniversario', parseInt(mes, 10))

  const { data, error } = await query
  if (error) throw new Error(`Erro ao ler cache Clinicorp: ${error.message}`)

  const items: Item[] = []
  for (const paciente of (data ?? []) as PacienteCache[]) {
    if (paciente.situacao && SITUACOES_EXCLUIDAS_CLINICORP.has(paciente.situacao)) continue

    const [ano, mesStr, diaStr] = (paciente.datanascimento ?? '').split('-')
    items.push(
      montarItem(
        {
          id: paciente.paciente_id,
          nome: paciente.nome,
          telefone: null,
          celular: paciente.telefone,
          mes: paciente.mes_aniversario,
          dia: paciente.dia_aniversario,
          datanascimento: ano && diaStr ? `${diaStr}/${mesStr}/${ano}` : '',
          situacao: paciente.situacao ?? '',
        },
        clinica,
        envioPorPaciente
      )
    )
  }
  return items
}

// GET /api/aniversariantes?mes=MM — aniversariantes da clínica do escopo.
// O `?clinica=` que o frontend ainda manda é ignorado: quem decide a clínica é
// o token verificado no proxy (Clinic-Control#74). Esta era a rota mais
// sensível do app — devolve nome, telefone e data de nascimento de paciente.
export async function GET(request: NextRequest) {
  const mes = request.nextUrl.searchParams.get('mes') ?? undefined

  try {
    const clinica = await getClinicaBySlug(requireClinicaSlug(request))

    const anoAtual = new Date().getFullYear()
    const { data: envios } = await getSupabaseAdmin()
      .from('aniversariantes_envios')
      .select('paciente_id_eclinica, status, scheduled_for, scheduled_message_id')
      .eq('clinica_id', clinica.id)
      .eq('ano', anoAtual)

    const envioPorPaciente = new Map((envios ?? []).map((e) => [String(e.paciente_id_eclinica), e]))

    const items =
      clinica.sistema_prontuario === 'clinicorp'
        ? await buscarDoCacheClinicorp(clinica, mes, envioPorPaciente)
        : await buscarDaEClinica(clinica, mes, envioPorPaciente)

    return NextResponse.json({ items })
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: (err as Error).message }, { status })
  }
}
