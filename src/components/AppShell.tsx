'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { ClinicaProvider } from './ClinicaProvider'
import { ClinicaSwitcher } from './ClinicaSwitcher'
import { AgendaIcon, GridIcon, ClockIcon } from './ui/icons'

const NAV = [
  { href: '/', label: 'Agenda', Icon: AgendaIcon },
  { href: '/modelos', label: 'Modelos', Icon: GridIcon },
  { href: '/historico', label: 'Histórico', Icon: ClockIcon },
]

function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="ml-2.5 flex items-center gap-5">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-1.5 text-sm font-medium transition-colors',
              active ? 'text-[var(--primary-from)]' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon className="h-[17px] w-[17px]" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ClinicaProvider>
      <div className="flex min-h-screen flex-col">
        {/* Este app roda embutido dentro da própria Helena (aba/iframe) — a
            identidade da conta (ex: "Oral Foz - Camila") já aparece na barra
            real deles acima, então aqui só a nav das nossas 3 telas + a
            clínica ativa (múltiplas clínicas podem compartilhar o mesmo
            deploy — ver ClinicaProvider). */}
        <header className="flex h-14 items-center gap-6 border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-2.5 text-[15px] font-semibold text-slate-900">
            <span className="block h-[22px] w-[22px] rounded-full bg-gradient-to-br from-[var(--primary-from)] via-[var(--primary-via)] to-[var(--primary-to)]" />
            Aniversariantes
          </div>
          <NavLinks />
          <div className="ml-auto">
            <ClinicaSwitcher />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto app-scroll bg-[var(--background)] p-6">{children}</main>
      </div>
    </ClinicaProvider>
  )
}
