'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ClinicaSwitcher } from './ClinicaSwitcher'
import clsx from 'clsx'

const NAV = [
  { href: '/', label: 'Aniversariantes', icon: '🎂' },
  { href: '/modelos', label: 'Modelos de mensagem', icon: '💬' },
  { href: '/historico', label: 'Histórico', icon: '🕓' },
]

function NavLinks() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qs = searchParams.toString()

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={qs ? `${item.href}?${qs}` : item.href}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white py-6">
        <div className="mb-8 flex items-center gap-2 px-4">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">Aniversariantes</p>
            <p className="text-xs text-slate-400 leading-tight">Mensagens automáticas</p>
          </div>
        </div>
        <Suspense fallback={<div className="px-3 text-sm text-slate-400">Carregando...</div>}>
          <NavLinks />
        </Suspense>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <p className="text-sm text-slate-500">Painel de aniversariantes</p>
          <Suspense fallback={<div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100" />}>
            <ClinicaSwitcher />
          </Suspense>
        </header>
        <main className="flex-1 overflow-y-auto app-scroll bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  )
}
