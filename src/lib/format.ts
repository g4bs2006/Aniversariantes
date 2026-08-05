// Normaliza telefone BR pro formato E.164 (com +55) exigido pelo `to` da Helena.
export function toE164BR(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length >= 12 && digits.startsWith('55')) return `+${digits}`
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`
  return null
}

// aniversario vem como "MM/DD" (já normalizado por nós a partir de `nascimento`)
export function parseAniversarioMonthDay(aniversario: string) {
  const [mes, dia] = aniversario.split('/').map((v) => parseInt(v, 10))
  return { mes, dia }
}

// O campo `aniversario` é guardado internamente como "MM/DD" (mais fácil pros
// cálculos de data acima). Pra exibir em tela ou inserir no texto da mensagem
// pro paciente, converte pro formato brasileiro "DD/MM".
export function aniversarioParaExibicao(aniversario: string) {
  const [mes, dia] = aniversario.split('/')
  return `${dia}/${mes}`
}

// A data de nascimento vem da e-Clínica como "YYYY-MM-DD", mas a API já foi
// vista respondendo com datas sentinela ("0000-00-00", "0001-01-01") quando o
// campo é vazio no cadastro. Retorna null se ausente/inválida.
export function parseDataYMD(raw: string | null | undefined) {
  if (!raw) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (!match) return null
  const [, ano, mes, dia] = match
  if (ano === '0000' || ano === '0001' || mes === '00' || dia === '00') return null
  return {
    aniversario: `${mes}/${dia}`,
    datanascimento: `${dia}/${mes}/${ano}`,
  }
}

// Alguns registros já vêm com `aniversario` pronto ("MM/DD"), sem a data
// completa — mesma lógica de sentinela: "00/00" = vazio.
export function parseAniversarioPronto(raw: string | null | undefined) {
  if (!raw || raw === '00/00') return null
  const [mes, dia] = raw.split('/')
  if (!mes || !dia || mes === '00' || dia === '00') return null
  return { aniversario: `${mes}/${dia}`, datanascimento: null as string | null }
}

// Brasil não tem mais horário de verão desde 2019 — offset fixo por timezone.
const FIXED_UTC_OFFSET: Record<string, number> = {
  'America/Sao_Paulo': -3,
  'America/Manaus': -4,
  'America/Rio_Branco': -5,
  'America/Noronha': -2,
}

// Data de "hoje" no fuso da clínica (o servidor roda em UTC na Vercel, então
// não dá pra usar getFullYear/getMonth/getDate do horário local do processo).
export function hojeNoTimezone(timezone: string) {
  const offset = FIXED_UTC_OFFSET[timezone] ?? -3
  const local = new Date(Date.now() + offset * 3_600_000)
  return { ano: local.getUTCFullYear(), mes: local.getUTCMonth() + 1, dia: local.getUTCDate() }
}

// Um aniversário que já passou neste ano NÃO deve ser agendado. Antes o
// cálculo empurrava pro ano seguinte, e agendar em lote no dia 5 mandava quem
// fez aniversário no dia 3 pra 2027 — parabéns fantasma, ocupando a chave
// única (clinica, paciente, ano) e escondendo o problema.
export function aniversarioJaPassou(mes: number, dia: number, timezone: string) {
  const hoje = hojeNoTimezone(timezone)
  if (mes !== hoje.mes) return mes < hoje.mes
  return dia < hoje.dia
}

// Margem usada quando o aniversário é hoje mas o horário padrão já passou:
// em vez de pular o dia, envia daqui a pouco.
const MINUTOS_DE_MARGEM = 5

// Retorna o instante do envio neste ano, ou null se o aniversário já passou.
export function nextOccurrence(
  mes: number,
  dia: number,
  timezone: string,
  hora: string
): Date | null {
  if (aniversarioJaPassou(mes, dia, timezone)) return null

  const offset = FIXED_UTC_OFFSET[timezone] ?? -3
  const hoje = hojeNoTimezone(timezone)
  const [hh, mm] = hora.split(':').map((v) => parseInt(v, 10))
  const candidate = new Date(Date.UTC(hoje.ano, mes - 1, dia, hh - offset, mm))

  // É hoje, mas o horário padrão da clínica já passou — a Helena rejeita
  // agendamento no passado, então joga pra alguns minutos à frente.
  if (candidate.getTime() <= Date.now()) {
    return new Date(Date.now() + MINUTOS_DE_MARGEM * 60_000)
  }
  return candidate
}

export function renderTemplatePreview(content: string, mapping: Record<string, string>, data: Record<string, string>) {
  let out = content
  for (const [param, field] of Object.entries(mapping)) {
    const value = data[field] ?? ''
    out = out.replaceAll(`{{${param}}}`, value)
  }
  return out
}
