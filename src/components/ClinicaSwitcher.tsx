'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useClinicas } from '@/hooks/useClinicas'
import { useEffect } from 'react'

export function ClinicaSwitcher() {
  const { clinicas, loading } = useClinicas()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('clinica')

  useEffect(() => {
    if (!current && clinicas.length > 0) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('clinica', clinicas[0].slug)
      router.replace(`${pathname}?${params.toString()}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, clinicas, pathname])

  function onChange(slug: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('clinica', slug)
    router.push(`${pathname}?${params.toString()}`)
  }

  if (loading) {
    return <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100" />
  }

  return (
    <select
      value={current ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-mid)]"
    >
      {clinicas.map((c) => (
        <option key={c.slug} value={c.slug}>
          {c.nome}
        </option>
      ))}
    </select>
  )
}
