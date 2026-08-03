export type DiaEnvio = 'aniversario' | '1_dia_antes' | '3_dias_antes'

export type StatusEnvio =
  | 'scheduled'
  | 'processed'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'canceled'
  | 'failed'

export interface Clinica {
  id: string
  slug: string
  nome: string
  eclinica_token: string
  eclinica_base_url: string
  helena_token: string
  helena_channel_id: string | null
  helena_from: string | null
  timezone: string
  created_at: string
}

export interface ClinicaPublica {
  id: string
  slug: string
  nome: string
}

export interface TemplateConfig {
  id: string
  clinica_id: string
  helena_template_id: string
  nome: string
  param_mapping: Record<string, string>
  dia_envio: DiaEnvio
  horario_envio: string
  is_default: boolean
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Envio {
  id: string
  clinica_id: string
  template_id: string | null
  paciente_id_eclinica: string
  paciente_nome: string
  paciente_telefone: string
  data_nascimento: string | null
  ano: number
  scheduled_message_id: string | null
  status: StatusEnvio
  scheduled_for: string | null
  created_at: string
}

// O endpoint `GET /aniversariantes` da e-Clínica é instável: em testes diretos
// (2026-08-03) o mesmo endpoint, sem nenhum parâmetro diferente, respondeu
// ora com um shape ("nome"/"aniversario"/"datanascimento"/"situacao" — igual
// à doc pública), ora com outro completamente diferente ("name"/"nascimento"/
// "clientesituacao_id"). Datas também vêm com sentinelas de "vazio"
// ("0000-00-00", "00/00"). Por isso os campos abaixo são todos opcionais e a
// normalização em src/lib/format.ts aceita qualquer um dos dois shapes.
export interface EClinicaCliente {
  id: number
  nome?: string
  name?: string
  aniversario?: string | null // "MM/DD" (pode vir "00/00" = vazio)
  datanascimento?: string | null // "YYYY-MM-DD" (pode vir "0000-00-00" = vazio)
  nascimento?: string | null // "YYYY-MM-DD" (shape alternativo)
  telefone: string | null
  celular: string | null
  situacao?: string | null
  clientesituacao_id?: string | null
}

// Shape normalizado que o resto do app consome (frontend + agendamento).
export interface Aniversariante {
  id: string
  nome: string
  telefone: string | null
  celular: string | null
  aniversario: string // "MM/DD", derivado de `nascimento`
  datanascimento: string // "DD/MM/AAAA", derivado de `nascimento`
  // ID de situação do cliente na e-Clínica (clientesituacao_id) — não temos o
  // mapeamento pros nomes reais, então é só informativo, não filtramos por ele.
  situacao: string
}
