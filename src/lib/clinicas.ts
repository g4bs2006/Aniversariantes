import { getSupabaseAdmin } from './supabase'
import type { Clinica } from '@/types/database'

export async function listClinicas() {
  const { data, error } = await getSupabaseAdmin()
    .from('aniversariantes_clinicas')
    .select('id, slug, nome')
    .order('nome')

  if (error) throw new Error(`Erro ao listar clínicas: ${error.message}`)
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
