import type { NextRequest } from 'next/server'
import { CLINICA_HEADER } from './clinica-token'

/**
 * Slug da clínica do escopo desta requisição.
 *
 * A ÚNICA fonte legítima é o header que o `proxy.ts` grava depois de verificar
 * o token assinado. As rotas NÃO devem mais ler `?clinica=` nem `clinica_slug`
 * do corpo: era exatamente isso que deixava o chamador escolher a clínica
 * (Clinic-Control#74). Os parâmetros continuam sendo aceitos e IGNORADOS, para
 * o frontend atual não quebrar — mas eles não decidem mais nada.
 *
 * Lança se o header não vier, e o modo de falha é deliberado: se alguém mudar o
 * `matcher` do proxy e tirar uma rota da cobertura, ela passa a responder erro
 * em vez de voltar silenciosamente a confiar no query param. O doc do Proxy
 * avisa justamente disso — mudança de matcher pode remover cobertura sem aviso.
 */
export function requireClinicaSlug(request: NextRequest): string {
  const slug = request.headers.get(CLINICA_HEADER)
  if (!slug) {
    throw new SemEscopoError()
  }
  return slug
}

export class SemEscopoError extends Error {
  readonly status = 401
  constructor() {
    super('Requisição sem escopo de clínica')
    this.name = 'SemEscopoError'
  }
}
