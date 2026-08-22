'use client'

// Tela para quando a clínica tem acesso válido mas ainda não foi provisionada.
//
// Acontece no caminho normal: o link da aba da Helena pode ser configurado
// antes de alguém provisionar a clínica no Clinic Control. Antes disto a tela
// dizia "Erro ao carregar clínicas" em vermelho — culpava quem não tem nada a
// consertar, porque a pessoa da clínica não pode se provisionar.
//
// Por isso NÃO há botão de ação: a ação é humana e está fora do app. O que a
// tela oferece é o identificador, que é o que a pessoa precisa ter em mão para
// pedir a liberação — sem ele o suporte não acha a conta.
//
// Substitui a nav também: Agenda, Modelos e Histórico não levam a lugar nenhum
// sem clínica, e deixá-los visíveis convida a três cliques em telas quebradas.

import { useState } from 'react'
import { Button } from './ui/Button'

export function ClinicaNaoLiberada({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(slug)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Clipboard bloqueado no iframe: o identificador está visível e
      // selecionável na tela, então não há o que consertar aqui.
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
        {/* O gradiente da identidade do app, uma vez só. Ancora a tela no
            produto sem decorar: é o mesmo mark do header. */}
        <span className="mx-auto mb-6 block h-12 w-12 rounded-full bg-gradient-to-br from-[var(--primary-from)] via-[var(--primary-via)] to-[var(--primary-to)]" />

        <h1 className="text-lg font-semibold leading-snug text-slate-900">
          Aniversariantes ainda não está liberado para esta clínica
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-slate-500">
          O painel existe, mas a sua clínica ainda não foi ativada nele. Quem administra a
          conta precisa fazer essa liberação.
        </p>

        {slug && (
          <div className="mt-7 text-left">
            <p className="text-[13px] text-slate-500">
              Ao pedir, informe este identificador — é por ele que a clínica é localizada.
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-slate-700" title={slug}>
                {slug}
              </code>
              <Button variant="secondary" size="sm" onClick={copiar} className="shrink-0">
                {copiado ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>
        )}

        <p className="mt-7 border-t border-slate-100 pt-5 text-[13px] leading-relaxed text-slate-400">
          Depois de liberada, recarregue esta aba — os aniversariantes aparecem aqui.
        </p>
      </div>
    </div>
  )
}
