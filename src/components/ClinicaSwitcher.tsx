'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useClinica } from './ClinicaProvider'
import { ChevronDownIcon } from './ui/icons'

export function ClinicaSwitcher() {
  const { slug, clinicas, loading, erro, setSlug } = useClinica()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (loading) return <span className="text-sm text-slate-400">Carregando clínicas...</span>
  if (erro) return <span className="text-sm text-red-500" title={erro}>Erro ao carregar clínicas</span>
  if (clinicas.length === 0) return <span className="text-sm text-red-500">Nenhuma clínica cadastrada</span>

  const atual = clinicas.find((c) => c.slug === slug) ?? clinicas[0]

  // Só 1 clínica cadastrada: mostra o nome fixo em vez de um seletor sem
  // utilidade (evita a UI de troca de clínica pra quem só atende uma).
  if (clinicas.length === 1) {
    return <span className="text-sm font-medium text-slate-600">{atual.nome}</span>
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-[38px] items-center gap-2 rounded-full bg-[var(--banner-info)] pl-3.5 pr-2 text-sm font-medium text-[var(--banner-info-fg)]"
      >
        {atual.nome}
        <ChevronDownIcon className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-10 mt-1.5 min-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {clinicas.map((c) => (
            <button
              key={c.slug}
              role="option"
              aria-selected={c.slug === slug}
              onClick={() => {
                setSlug(c.slug)
                setOpen(false)
              }}
              className={clsx(
                'block w-full px-3.5 py-2.5 text-left text-sm whitespace-nowrap',
                c.slug === slug
                  ? 'bg-[var(--banner-info)] font-medium text-[var(--banner-info-fg)]'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
