import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!

let _admin: ReturnType<typeof createClient<Database>> | null = null

// Toda leitura/escrita passa pelo service role no backend — não existe
// acesso direto do browser às tabelas (mesmo padrão do Contact-Calendar).
export function getSupabaseAdmin() {
  if (!_admin) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')
    _admin = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _admin
}
