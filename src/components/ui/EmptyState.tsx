import clsx from 'clsx'
import { Button } from './Button'

interface Action {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  variant?: 'empty' | 'error'
  title: string
  description: string
  action?: Action
  secondaryAction?: Action
}

export function EmptyState({ variant = 'empty', title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-8 py-11 text-center">
      <div
        className={clsx(
          'mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full',
          variant === 'error'
            ? 'bg-[var(--status-canceled)] text-[var(--status-canceled-fg)]'
            : 'border border-slate-200 bg-[var(--primary-soft)]'
        )}
      >
        {variant === 'error' && <span className="font-sans text-lg font-semibold">!</span>}
      </div>
      <h4 className="mb-1.5 text-base font-semibold text-slate-900">{title}</h4>
      <p className="mx-auto mb-4 max-w-sm text-[15px] leading-relaxed text-slate-500">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex justify-center gap-2">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
