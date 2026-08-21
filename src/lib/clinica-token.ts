import { createHmac, timingSafeEqual } from 'node:crypto'

// Token de escopo de clínica: assinado pelo Clinic Control, verificado aqui.
//
// POR QUE EXISTE. Este app não tinha autenticação nenhuma (Clinic-Control#74):
// a URL da Vercel é pública, e toda rota recebia o slug da clínica no próprio
// request (`?clinica=` ou `clinica_slug` no corpo) sem verificar direito de
// acesso — com `/api/clinicas` entregando a lista completa de slugs de bandeja.
// Eram dois furos independentes: nenhum gate, e nenhum isolamento entre
// clínicas. Um token que CARREGA o slug fecha os dois de uma vez, porque a
// clínica deixa de ser escolha do chamador e passa a ser parte da credencial.
//
// O "embutido na Helena via iframe" que o README descreve não é controle de
// acesso: um `<iframe>` não impede ninguém de abrir a URL direto. O que
// protegia o app até aqui era a obscuridade da URL.
//
// COMO O TOKEN CHEGA. Duas origens, os dois assinados pelo Clinic Control:
//   - Aba da Helena de cada clínica: link SEM expiração, colado uma vez na
//     configuração da aba. É a credencial de longa duração daquela clínica.
//   - Botão "Abrir Aniversariantes" no Clinic Control: link COM expiração
//     curta, para a equipe interna abrir no contexto de uma clínica.
//
// NÃO é JWT de propósito: não há claim para negociar, nem biblioteca para
// versionar. Payload é `{v,slug,exp}` e nada mais — o que não existe no formato
// não pode ser mal interpretado depois.
//
// Isto é o paliativo da #74, não o desenho final. O definitivo é a sessão do
// Clinic Control com escopo por carteira (`listClinicsInScope()`), junto com o
// porte do setup. Enquanto for token, quem tem o link tem o acesso àquela
// clínica — e um link de aba da Helena não expira, então vazá-lo é permanente
// até o segredo ser rotacionado.

export const CLINICA_HEADER = 'x-clinica-slug'

export interface ClinicaTokenPayload {
  v: 1
  slug: string
  /** Unix seconds. `null` = sem expiração (link da aba da Helena). */
  exp: number | null
}

function secret(): string {
  const s = process.env.ANIVERSARIANTES_LINK_SECRET
  // Falha fechado. Sem segredo não há como distinguir token válido de forjado,
  // e o modo de falha correto é ninguém entrar — não todos entrarem.
  if (!s) throw new Error('ANIVERSARIANTES_LINK_SECRET não configurada')
  return s
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', secret()).update(encodedPayload).digest('base64url')
}

/** Assina um token de escopo. `expiresInSeconds: null` = sem expiração. */
export function signClinicaToken(slug: string, expiresInSeconds: number | null): string {
  const payload: ClinicaTokenPayload = {
    v: 1,
    slug,
    exp: expiresInSeconds === null ? null : Math.floor(Date.now() / 1000) + expiresInSeconds,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

/**
 * Verifica assinatura e expiração. Devolve o payload ou `null` — nunca lança
 * por token inválido, só por segredo ausente. Quem chama não deve distinguir
 * "assinatura errada" de "expirado" para o cliente: as duas respostas são 401.
 */
export function verifyClinicaToken(token: string | undefined | null): ClinicaTokenPayload | null {
  if (!token) return null

  const parte = token.split('.')
  if (parte.length !== 2) return null
  const [encoded, assinatura] = parte

  const esperada = Buffer.from(sign(encoded), 'utf8')
  const recebida = Buffer.from(assinatura, 'utf8')
  // timingSafeEqual exige mesmo tamanho — comparar antes, senão ele lança.
  if (esperada.length !== recebida.length) return null
  if (!timingSafeEqual(esperada, recebida)) return null

  let payload: ClinicaTokenPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  // Assinatura válida mas formato inesperado: trata como inválido em vez de
  // seguir com `slug` undefined, que viraria um escopo vazio silencioso.
  if (payload?.v !== 1 || typeof payload.slug !== 'string' || !payload.slug) return null
  if (payload.exp !== null && (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000)) {
    return null
  }

  return payload
}
