import { Loader2 } from 'lucide-react'

/**
 * Button variants: 'primary' | 'ghost' | 'danger' | 'outline'
 * Sizes: 'sm' | 'md' | 'lg'
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-body font-semibold rounded-xl transition-all duration-150 cursor-pointer select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2'

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const variants = {
    primary: 'bg-[var(--brand)] text-[var(--text-inverse)] hover:bg-[var(--brand-hover)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow)] hover:-translate-y-px active:translate-y-0',
    ghost:   'bg-transparent text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]',
    danger:  'bg-[var(--error)] text-white hover:opacity-90 shadow-[var(--shadow-sm)]',
    outline: 'bg-transparent text-[var(--brand)] border border-[var(--brand)] hover:bg-[var(--brand-light)]',
  }

  const isDisabled = disabled || loading

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin flex-shrink-0" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : 16} className="flex-shrink-0" />
      ) : null}
      {children}
    </button>
  )
}
