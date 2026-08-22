'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ClinicaPublica } from '@/types/database'

const STORAGE_KEY = 'aniversariantes_clinica_slug'

interface ClinicaContextValue {
  slug: string
  clinicas: ClinicaPublica[]
  loading: boolean
  erro: string | null
  /**
   * Token válido, clínica não provisionada. Estado SEPARADO de `erro` porque a
   * ação é diferente: erro pede tentar de novo, isto pede falar com quem
   * administra a conta — e quem está na tela não pode se provisionar.
   */
  naoProvisionada: { slug: string } | null
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
  const [naoProvisionada, setNaoProvisionada] = useState<{ slug: string } | null>(null)

  useEffect(() => {
    fetch('/api/clinicas')
      .then(async (r) => ({ status: r.status, body: await r.json() }))
      .then(({ body: data }) => {
        // 404 com código é o caminho normal de "ainda não liberado", não falha.
        if (data.code === 'CLINICA_NAO_PROVISIONADA') {
          setNaoProvisionada({ slug: data.slug ?? '' })
          return
        }
        if (data.error) throw new Error(data.error)
        const lista = (data.clinicas ?? []) as ClinicaPublica[]
        setClinicas(lista)

        // ?clinica=<slug> tem prioridade sobre o localStorage — é o que o Clinic
        // Control usa no botão "Abrir Aniversariantes" (aba Cadastro da clínica),
        // pra abrir direto na clínica certa em vez de na última usada no browser.
        // Mesmo nome de parâmetro que as rotas de API já aceitam (ver README).
        const daUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('clinica')
            : null
        const salva = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
        const alvo = daUrl || salva
        const inicial = lista.find((c) => c.slug === alvo) ?? lista[0]
        if (inicial) setSlug(inicial.slug)
      })
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  function setSlug(novo: string) {
    setSlugState(novo)
    window.localStorage.setItem(STORAGE_KEY, novo)
  }

  return (
    <ClinicaContext.Provider value={{ slug, clinicas, loading, erro, naoProvisionada, setSlug }}>
      {children}
    </ClinicaContext.Provider>
  )
}

export function useClinica() {
  const ctx = useContext(ClinicaContext)
  if (!ctx) throw new Error('useClinica precisa estar dentro de <ClinicaProvider>')
  return ctx
}
