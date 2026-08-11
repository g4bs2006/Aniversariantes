import clsx from 'clsx'
import { InfoIcon, WarningIcon, XIcon } from './icons'

interface BannerProps {
  variant?: 'info' | 'warning'
  children: React.ReactNode
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

// Faixa fina pra avisos leves/recuperáveis (ex: falha pontual que não
// impede a tela de funcionar) — diferente do EmptyState, que é só pra
// quando não há nada de fato pra mostrar.
export function Banner({ variant = 'info', children, action, onDismiss }: BannerProps) {
  const warning = variant === 'warning'
  const Icon = warning ? WarningIcon : InfoIcon

  return (
    <div
      className={clsx(
        'flex items-center gap-2.5 rounded-lg px-4 py-2.5',
        warning ? 'bg-[var(--banner-warning)] text-[var(--banner-warning-fg)]' : 'bg-[var(--banner-info)] text-[var(--banner-info-fg)]'
      )}
    >
      <Icon className="shrink-0" />
      <span className="flex-1 text-sm leading-snug">{children}</span>
      {action && (
        <button onClick={action.onClick} className="text-sm font-medium underline underline-offset-2">
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Fechar aviso" className="shrink-0 opacity-70 hover:opacity-100">
          <XIcon width={14} height={14} />
        </button>
      )}
    </div>
  )
}
