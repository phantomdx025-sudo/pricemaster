import { Loader2 } from 'lucide-react'

export default function Spinner({ size = 20, className = '', color }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin ${className}`}
      style={{ color: color ?? 'var(--brand)' }}
    />
  )
}
