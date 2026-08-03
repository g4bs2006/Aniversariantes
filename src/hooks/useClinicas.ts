'use client'

import { useEffect, useState } from 'react'
import type { ClinicaPublica } from '@/types/database'

export function useClinicas() {
  const [clinicas, setClinicas] = useState<ClinicaPublica[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/clinicas')
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (data.error) setError(data.error)
        else setClinicas(data.clinicas ?? [])
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return { clinicas, loading, error }
}
