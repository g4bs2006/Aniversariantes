'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const NAV = [
  { href: '/', label: 'Aniversariantes', icon: '🎂' },
  { href: '/modelos', label: 'Modelos de mensagem', icon: '💬' },
  { href: '/historico', label: 'Histórico', icon: '🕓' },
]

function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'text-[var(--primary)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            )}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Este app roda embutido dentro da própria Helena (aba/iframe) — a
          identidade da conta (ex: "Oral Foz - Camila") já aparece na barra
          real deles acima, então aqui só a nav das nossas 3 telas. */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none">🎉</span>
          <NavLinks />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto app-scroll bg-[var(--background)] p-6">{children}</main>
    </div>
  )
}
