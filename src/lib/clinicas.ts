import { getSupabaseAdmin } from './supabase'
import type { Clinica } from '@/types/database'

/**
 * A clínica tem token válido mas não está provisionada aqui.
 *
 * NÃO é erro de sistema, e por isso tem tipo próprio. Acontece no caminho
 * normal: o link da aba da Helena pode ser configurado antes de alguém
 * provisionar a clínica no Clinic Control. Tratar isso como 500 fazia a tela
 * dizer "Erro ao carregar clínicas" para quem não tem nada a consertar — a
 * pessoa da clínica não pode se provisionar.
 */
export class ClinicaNaoProvisionadaError extends Error {
  readonly code = 'CLINICA_NAO_PROVISIONADA' as const
  readonly status = 404
  constructor(readonly slug: string) {
    super(`Clínica "${slug}" não está provisionada no Aniversariantes`)
    this.name = 'ClinicaNaoProvisionadaError'
  }
}

// Dados públicos da clínica do escopo — o que o header do frontend precisa
// mostrar, sem nenhuma credencial.
//
// SUBSTITUIU um `listClinicas()` que devolvia TODAS as clínicas cadastradas,
// sem autenticação, numa rota pública. Era o mapa que tornava o resto
// explorável: pegava-se a lista de slugs aqui e passava qualquer um deles para
// as outras rotas (Clinic-Control#74). Não existe caso de uso legítimo para
// enumerar clínicas neste app — cada acesso é escopado a uma.
export async function getClinicaPublicaBySlug(slug: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('aniversariantes_clinicas')
    .select('id, slug, nome')
    .eq('slug', slug)
    .single()

  if (error || !data) throw new ClinicaNaoProvisionadaError(slug)
  return data
}

export async function getClinicaBySlug(slug: string): Promise<Clinica> {
  const { data, error } = await getSupabaseAdmin()
    .from('aniversariantes_clinicas')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) throw new ClinicaNaoProvisionadaError(slug)
  return data as Clinica
}
