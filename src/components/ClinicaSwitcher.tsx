'use client'

import { useClinica } from './ClinicaProvider'

export function ClinicaSwitcher() {
  const { slug, clinicas, loading, erro, setSlug } = useClinica()

  if (loading) return <span className="text-sm text-slate-400">Carregando clínicas...</span>
  if (erro) return <span className="text-sm text-red-500" title={erro}>Erro ao carregar clínicas</span>
  if (clinicas.length === 0) return <span className="text-sm text-red-500">Nenhuma clínica cadastrada</span>

  // Só 1 clínica cadastrada: mostra o nome fixo em vez de um seletor sem
  // utilidade (evita a UI de troca de clínica pra quem só atende uma).
  if (clinicas.length === 1) {
    return <span className="text-sm font-medium text-slate-600">{clinicas[0].nome}</span>
  }

  return (
    <select
      value={slug}
      onChange={(e) => setSlug(e.target.value)}
      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
      aria-label="Clínica"
    >
      {clinicas.map((c) => (
        <option key={c.slug} value={c.slug}>{c.nome}</option>
      ))}
    </select>
  )
}
