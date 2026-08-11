'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ClinicaPublica } from '@/types/database'

const STORAGE_KEY = 'aniversariantes_clinica_slug'

interface ClinicaContextValue {
  slug: string
  clinicas: ClinicaPublica[]
  loading: boolean
  erro: string | null
  setSlug: (slug: string) => void
}

const ClinicaContext = createContext<ClinicaContextValue | null>(null)

// Carrega as clínicas cadastradas 1x (no shell, não em cada tela) e mantém a
// escolha atual compartilhada entre Aniversariantes/Modelos/Histórico —
// trocar de clínica numa tela reflete nas outras sem precisar re-selecionar.
export function ClinicaProvider({ children }: { children: React.ReactNode }) {
  const [clinicas, setClinicas] = useState<ClinicaPublica[]>([])
  const [slug, setSlugState] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clinicas')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        const lista = (data.clinicas ?? []) as ClinicaPublica[]
        setClinicas(lista)

        const salva = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
        const inicial = lista.find((c) => c.slug === salva) ?? lista[0]
        if (inicial) setSlugState(inicial.slug)
      })
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  function setSlug(novo: string) {
    setSlugState(novo)
    window.localStorage.setItem(STORAGE_KEY, novo)
  }

  return (
    <ClinicaContext.Provider value={{ slug, clinicas, loading, erro, setSlug }}>{children}</ClinicaContext.Provider>
  )
}

export function useClinica() {
  const ctx = useContext(ClinicaContext)
  if (!ctx) throw new Error('useClinica precisa estar dentro de <ClinicaProvider>')
  return ctx
}
