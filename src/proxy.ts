import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CLINICA_HEADER, verifyClinicaToken } from '@/lib/clinica-token'

// Gate de acesso do app (Clinic-Control#74). Antes disto, a UI e 5 das 6 rotas
// de API eram abertas na URL pública da Vercel — qualquer pessoa listava
// paciente com nome/telefone/nascimento e agendava WhatsApp em nome da clínica.
//
// `proxy.ts`, NÃO `middleware.ts`: no Next 16 a convenção `middleware` está
// deprecada e foi renomeada para `proxy` (ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
// Escrever `middleware.ts` aqui não daria erro — simplesmente não rodaria,
// que é o pior modo de falha possível para um gate de segurança.
//
// Roda no runtime Node.js, que é o default do Proxy no Next 16 (era Edge
// antes). É o que permite `node:crypto` no clinica-token em vez de WebCrypto.

const COOKIE = 'av_scope'

// Cobre tudo menos assets e a rota de cron. O negative match é obrigatório:
// sem `matcher`, o Proxy roda em `_next/static` também e o gate derrubaria o
// CSS e o JS da própria página de erro.
//
// `api/cron` fica fora porque tem a própria autenticação (CRON_SECRET, que a
// Vercel injeta) e o Vercel Cron não tem como carregar token de clínica — ele
// roda para todas as clínicas de uma vez, não no escopo de uma.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/cron).*)'],
}

function negar(request: NextRequest) {
  const ehApi = request.nextUrl.pathname.startsWith('/api/')
  if (ehApi) {
    return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 })
  }
  // A UI vive dentro de um iframe na Helena. Redirecionar para uma tela de
  // login não ajuda (não há login), então responde texto curto — quem abriu
  // sem token não tem ação possível a não ser pedir o link certo.
  return new NextResponse(
    'Acesso não autorizado. Abra o painel pela aba da Helena da sua clínica ou pelo Clinic Control.',
    { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } },
  )
}

export function proxy(request: NextRequest) {
  // Token novo na URL tem prioridade sobre o cookie: é assim que se troca de
  // clínica (abrir o link de outra clínica sobrescreve o escopo) e é o caminho
  // do primeiro acesso, quando cookie ainda não existe.
  const daUrl = request.nextUrl.searchParams.get('t')
  const doCookie = request.cookies.get(COOKIE)?.value

  let payload = verifyClinicaToken(daUrl)
  const veioDaUrl = payload !== null
  if (!payload) payload = verifyClinicaToken(doCookie)
  if (!payload) return negar(request)

  const headers = new Headers(request.headers)
  // `set`, não `append`: sobrescreve qualquer x-clinica-slug que o cliente
  // tenha mandado. É o que torna o header confiável rio acima — sem isto, um
  // curl com o header definido escolheria a própria clínica.
  headers.set(CLINICA_HEADER, payload.slug)

  const ehApi = request.nextUrl.pathname.startsWith('/api/')
  const producao = process.env.NODE_ENV === 'production'

  // Token válido na URL numa navegação: guarda no cookie e tira o `t` da URL
  // por redirect. Sem isso o token fica no histórico do browser, no Referer das
  // requisições que saem da página, e em qualquer log que registre query string.
  //
  // Só para navegação. Uma chamada de API não pode ser redirecionada — um POST
  // viraria GET no follow, ou o fetch trataria o 307 como resposta. As chamadas
  // de API do frontend são same-origin e já carregam o cookie; o `?t=` só
  // aparece no primeiro carregamento da página.
  if (veioDaUrl && !ehApi) {
    const limpa = request.nextUrl.clone()
    limpa.searchParams.delete('t')
    const redirect = NextResponse.redirect(limpa)
    redirect.cookies.set({
      name: COOKIE,
      value: daUrl!,
      httpOnly: true,
      // `none` porque a página roda em iframe de outro domínio (a Helena) — com
      // `lax` o cookie não acompanharia a navegação dentro do iframe. Mas o
      // browser REJEITA `none` sem `secure`, e em dev local o host é http://,
      // então lá cai para `lax` (onde não há iframe da Helena de todo modo).
      secure: producao,
      sameSite: producao ? 'none' : 'lax',
      path: '/',
      // Sem `maxAge`: cookie de sessão. O link da aba da Helena não expira, e
      // reabrir a aba reenvia o token — não há ganho em persistir no disco.
    })
    return redirect
  }

  return NextResponse.next({ request: { headers } })
}
