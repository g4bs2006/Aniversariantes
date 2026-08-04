import clsx from 'clsx'
import type { StatusEnvio } from '@/types/database'

const STATUS_LABEL: Record<StatusEnvio | 'none', string> = {
  none: 'Não agendado',
  scheduled: 'Agendado',
  processed: 'Processando',
  sent: 'Enviado',
  delivered: 'Entregue',
  read: 'Lido',
  canceled: 'Cancelado',
  failed: 'Falhou',
}

const STATUS_STYLE: Record<StatusEnvio | 'none', string> = {
  none: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-[var(--status-scheduled)] text-[var(--status-scheduled-fg)]',
  processed: 'bg-[var(--status-scheduled)] text-[var(--status-scheduled-fg)]',
  sent: 'bg-green-100 text-green-700',
  delivered: 'bg-green-100 text-green-700',
  read: 'bg-green-100 text-green-700',
  canceled: 'bg-red-100 text-red-700',
  failed: 'bg-amber-100 text-amber-800',
}

export function StatusBadge({ status }: { status: StatusEnvio | 'none' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        STATUS_STYLE[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
