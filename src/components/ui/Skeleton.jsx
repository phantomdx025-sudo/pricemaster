/**
 * Skeleton — animated placeholder for loading states.
 * Usage: <Skeleton className="h-4 w-32 rounded" />
 *        <Skeleton.Row />       — a full item table row skeleton
 *        <Skeleton.Card />      — a mobile item card skeleton
 */

function Base({ className = '' }) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{ background: 'var(--border)' }}
    />
  )
}

function Row() {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="px-4 py-3 w-12">
        <Base className="h-3 w-6 rounded ml-auto" />
      </td>
      <td className="px-4 py-3">
        <Base className="h-3 rounded" style={{ width: `${55 + Math.random() * 30}%` }} />
      </td>
      {[...Array(5)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Base className="h-3 w-14 rounded ml-auto" />
        </td>
      ))}
    </tr>
  )
}

function Card() {
  return (
    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <Base className="h-3.5 rounded flex-1" style={{ maxWidth: '60%' }} />
        <div className="flex gap-1">
          <Base className="h-7 w-7 rounded-lg" />
          <Base className="h-7 w-7 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <Base key={i} className="h-3 rounded" />
        ))}
      </div>
    </div>
  )
}

Base.Row = Row
Base.Card = Card

export default Base
