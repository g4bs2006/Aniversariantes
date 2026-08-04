import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3.5 py-1.5 text-sm' : 'px-5 py-2 text-sm',
        variant === 'primary' &&
          'text-white shadow-sm hover:opacity-90 bg-gradient-to-r from-[var(--primary-from)] to-[var(--primary-to)]',
        variant === 'secondary' && 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        variant === 'danger' && 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
        className
      )}
      {...props}
    />
  )
}
