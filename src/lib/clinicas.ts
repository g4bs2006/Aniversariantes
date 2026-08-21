import { getSupabaseAdmin } from './supabase'
import type { Clinica } from '@/types/database'

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

  if (error || !data) throw new Error(`Clínica "${slug}" não encontrada`)
  return data
}

export async function getClinicaBySlug(slug: string): Promise<Clinica> {
  const { data, error } = await getSupabaseAdmin()
    .from('aniversariantes_clinicas')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) throw new Error(`Clínica "${slug}" não encontrada`)
  return data as Clinica
}
