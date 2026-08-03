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

// `nascimento` vem da e-Clínica como "YYYY-MM-DD". Retorna null se ausente/inválido.
export function parseNascimento(nascimento: string | null) {
  if (!nascimento) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimento)
  if (!match) return null
  const [, ano, mes, dia] = match
  return {
    aniversario: `${mes}/${dia}`,
    datanascimento: `${dia}/${mes}/${ano}`,
  }
}

// Brasil não tem mais horário de verão desde 2019 — offset fixo por timezone.
const FIXED_UTC_OFFSET: Record<string, number> = {
  'America/Sao_Paulo': -3,
  'America/Manaus': -4,
  'America/Rio_Branco': -5,
  'America/Noronha': -2,
}

export function nextOccurrence(mes: number, dia: number, timezone: string, hora: string) {
  const offset = FIXED_UTC_OFFSET[timezone] ?? -3
  const now = new Date()
  const [hh, mm] = hora.split(':').map((v) => parseInt(v, 10))
  let year = now.getFullYear()
  let candidate = new Date(Date.UTC(year, mes - 1, dia, hh - offset, mm))
  // Se a data já passou este ano, agenda pro ano seguinte.
  if (candidate.getTime() < now.getTime()) {
    year += 1
    candidate = new Date(Date.UTC(year, mes - 1, dia, hh - offset, mm))
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
