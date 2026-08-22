import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CLINICA_HEADER, signClinicaToken, verifyClinicaToken } from '@/lib/clinica-token'

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

/**
 * Hosts do white label autorizados a informar a clínica pela URL.
 *
 * A plataforma monta a URL por espectador — `?clinica=<id da conta>` — e é isso
 * que permite uma única configuração de aba servir todas as clínicas. Como esse
 * id NÃO vem assinado, o Referer é a única evidência de que ele veio do embed
 * e não de alguém digitando na barra de endereços.
 *
 * É barreira, não garantia: Referer é falsificável por quem monta a requisição
 * à mão. Ver o comentário sobre a troca em `escopoDoHost`.
 */
const EMBED_HOSTS = (process.env.ANIVERSARIANTES_EMBED_HOSTS ?? 'app.fluxodonto.com')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)

/** Token que nós mesmos emitimos a partir do id do host: 12h, não eterno. */
const HOST_SCOPE_TTL = 60 * 60 * 12

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A clínica que o host informou na URL, se for aceitável.
 *
 * TROCA ACEITA, e está aqui para quem for ler depois: o id não é assinado, então
 * quem conhecer o id de OUTRA clínica e conseguir apresentar um Referer do host
 * entra no lugar dela. Isso é um passo atrás do link assinado por clínica, e foi
 * aceito porque a plataforma tem uma única configuração de aba para todas as
 * clínicas — sem isso a feature não funciona para ninguém.
 *
 * O que segura o risco na prática: os ids não são mais enumeráveis (a rota
 * /api/clinicas devolve só a clínica do escopo desde a Clinic-Control#74), então
 * é preciso obter o id por fora.
 *
 * O que resolveria de verdade: a plataforma assinar o valor, ou permitir
 * configuração de aba por clínica — aí volta o link assinado.
 */
function escopoDoHost(request: NextRequest): string | null {
  const clinica = request.nextUrl.searchParams.get('clinica')
  // Placeholder não substituído (`{idaccount}`) e lixo não passam: um id
  // inválido viraria consulta ao banco com valor arbitrário.
  if (!clinica || !UUID.test(clinica)) return null

  const referer = request.headers.get('referer')
  if (!referer) return null
  try {
    const host = new URL(referer).hostname.toLowerCase()
    return EMBED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) ? clinica : null
  } catch {
    return null
  }
}

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

function negar(request: NextRequest, motivo = 'sem-token') {
  const ehApi = request.nextUrl.pathname.startsWith('/api/')
  if (ehApi) {
    return NextResponse.json({ error: 'Acesso não autorizado', motivo }, { status: 401 })
  }
  // A UI vive dentro de um iframe na Helena. Redirecionar para uma tela de
  // login não ajuda (não há login), então responde texto curto — quem abriu
  // sem token não tem ação possível a não ser pedir o link certo.
  const texto =
    motivo === 'escopo-divergente'
      ? 'Este link não corresponde à sua clínica. Peça a quem administra a conta o link correto do painel.'
      : 'Acesso não autorizado. Abra o painel pela aba da sua clínica na plataforma.'
  return new NextResponse(texto, {
    status: 401,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export function proxy(request: NextRequest) {
  // Token novo na URL tem prioridade sobre o cookie: é assim que se troca de
  // clínica (abrir o link de outra clínica sobrescreve o escopo) e é o caminho
  // do primeiro acesso, quando cookie ainda não existe.
  const daUrl = request.nextUrl.searchParams.get('t')
  const doCookie = request.cookies.get(COOKIE)?.value

  let payload = verifyClinicaToken(daUrl)
  // Token assinado na URL é o caminho interno (botão "Abrir" do Clinic Control).
  let novoToken = payload ? daUrl : null

  // Caminho do white label: a plataforma monta a URL com o id da clínica de
  // quem está vendo. Emitimos NOSSO token a partir dele, de 12h, para que tudo
  // rio acima continue lendo um token verificado — a decisão de confiança fica
  // num lugar só, em vez de espalhada por rota.
  if (!payload) {
    const doHost = escopoDoHost(request)
    if (doHost) {
      novoToken = signClinicaToken(doHost, HOST_SCOPE_TTL)
      payload = verifyClinicaToken(novoToken)
    }
  }

  if (!payload) payload = verifyClinicaToken(doCookie)
  if (!payload) return negar(request)

  // A URL declara uma clínica e o escopo resolvido é OUTRA: recusa.
  //
  // Isto existe por causa de um vazamento real em 22/08. Um link específico de
  // clínica foi colado numa configuração de aba que vale para TODAS, então toda
  // clínica que abria recebia o cookie daquela e via os pacientes dela. E o
  // agravante: o cookie de sessão continuava vencendo depois, mesmo quando a
  // URL passava a declarar a clínica certa — o proxy não olhava `?clinica=`.
  //
  // Cobre também o caso do placeholder não substituído (`{idaccount}` literal):
  // ele não bate com nenhum slug, então recusa em vez de servir a clínica do
  // último cookie.
  //
  // Servir a clínica errada é pior que não servir nada: silencioso, e quem vê
  // não tem como saber que está olhando dado de outra pessoa.
  const clinicaNaUrl = request.nextUrl.searchParams.get('clinica')
  if (clinicaNaUrl && clinicaNaUrl !== payload.slug) {
    return negar(request, 'escopo-divergente')
  }

  const headers = new Headers(request.headers)
  // `set`, não `append`: sobrescreve qualquer x-clinica-slug que o cliente
  // tenha mandado. É o que torna o header confiável rio acima — sem isto, um
  // curl com o header definido escolheria a própria clínica.
  headers.set(CLINICA_HEADER, payload.slug)

  const ehApi = request.nextUrl.pathname.startsWith('/api/')
  const producao = process.env.NODE_ENV === 'production'

  // Grava o escopo em cookie para as chamadas de API subsequentes.
  //
  // Duas formas, e a diferença NÃO é cosmética:
  //
  // · Token assinado veio no `?t=` (link interno): responde REDIRECT tirando o
  //   `t` da URL. Sem isso o token fica no histórico do browser, no Referer das
  //   requisições que saem da página e em qualquer log de query string.
  //
  // · Escopo veio do host (`?clinica=`): NÃO redireciona. O `?clinica=` precisa
  //   permanecer na URL — é o que a plataforma monta, e é o que a checagem de
  //   escopo divergente compara. Redirecionar aqui apontaria para a própria URL
  //   e entraria em loop infinito, porque não há nada para remover.
  const cookieOpts = {
    name: COOKIE,
    value: novoToken ?? '',
    httpOnly: true,
    // `none` porque a página roda em iframe de outro domínio — com `lax` o
    // cookie não acompanharia a navegação dentro do iframe. Mas o browser
    // REJEITA `none` sem `secure`, e em dev local o host é http://, então lá
    // cai para `lax` (onde não há iframe de todo modo).
    secure: producao,
    sameSite: (producao ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    // Sem `maxAge`: cookie de sessão. O token emitido a partir do host já
    // expira em 12h por conta própria.
  }

  if (novoToken && !ehApi && daUrl) {
    const limpa = request.nextUrl.clone()
    limpa.searchParams.delete('t')
    const redirect = NextResponse.redirect(limpa)
    redirect.cookies.set(cookieOpts)
    return redirect
  }

  const res = NextResponse.next({ request: { headers } })
  if (novoToken) res.cookies.set(cookieOpts)
  return res

}
