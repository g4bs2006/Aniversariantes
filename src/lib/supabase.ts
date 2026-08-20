import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!

// As tabelas `aniversariantes_*` estão saindo de `public` para um schema
// dedicado (Clinic-Control#71). O schema é configurável só para viabilizar o
// corte: este código sobe com o default `public` (sem mudança de
// comportamento), as tabelas são movidas, e só então a env var é flipada. Sem
// isso, o move exigiria deploy no mesmo instante do ALTER, sem rollback barato.
//
// O `as 'public'` é deliberado. A chave de topo de `Database` é o NOME do
// schema, mas o conteúdo é idêntico nos dois — a migração move as tabelas, não
// as redefine. Então os tipos gerados descrevem corretamente as tabelas em
// qualquer um dos dois nomes, e o cast evita ter que carregar dois schemas
// no arquivo de tipos durante a transição.
//
// Ao fechar a migração: regerar os tipos apontando para o schema novo e trocar
// isto por uma constante, sem cast.
const SCHEMA = (process.env.ANIVERSARIANTES_DB_SCHEMA ?? 'public') as 'public'

let _admin: ReturnType<typeof createClient<Database>> | null = null

// Toda leitura/escrita passa pelo service role no backend — não existe
// acesso direto do browser às tabelas (mesmo padrão do Contact-Calendar).
export function getSupabaseAdmin() {
  if (!_admin) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')
    _admin = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: SCHEMA },
    })
  }
  return _admin
}
