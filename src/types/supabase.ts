import type { DiaEnvio, StatusEnvio } from './database'

export interface Database {
  public: {
    Tables: {
      aniversariantes_clinicas: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['aniversariantes_clinicas']['Row']> & {
          slug: string
          nome: string
          eclinica_token: string
          helena_token: string
        }
        Update: Partial<Database['public']['Tables']['aniversariantes_clinicas']['Row']>
        Relationships: []
      }
      aniversariantes_templates: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['aniversariantes_templates']['Row']> & {
          clinica_id: string
          helena_template_id: string
        }
        Update: Partial<Database['public']['Tables']['aniversariantes_templates']['Row']>
        Relationships: []
      }
      aniversariantes_envios: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['aniversariantes_envios']['Row']> & {
          clinica_id: string
          paciente_id_eclinica: string
          paciente_nome: string
          paciente_telefone: string
          ano: number
          status: StatusEnvio
        }
        Update: Partial<Database['public']['Tables']['aniversariantes_envios']['Row']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
