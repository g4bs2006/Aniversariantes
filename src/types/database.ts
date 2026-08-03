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

export interface Aniversariante {
  id: string
  nome: string
  telefone: string
  celular: string
  aniversario: string
  datanascimento: string
  situacao: 'ATIVO' | 'INATIVO'
}
