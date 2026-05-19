/**
 * FinPartyCard — one row/card per party in the Financial Reports list.
 * Mobile: full-width card layout.
 * Desktop: table-row style with more columns visible.
 */
import { Phone, MapPin, Star } from 'lucide-react'

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function StatusBadge({ status }) {
  const map = {
    'Receivable': { bg: 'var(--brand-light)',   color: 'var(--brand)',   label: 'Receivable' },
    'Payable':    { bg: 'var(--error-light)',    color: 'var(--error)',   label: 'Payable'    },
    'Settled ✓':  { bg: 'var(--success-light)',  color: 'var(--success)', label: 'Settled ✓'  },
    'Credit Bal ⚠': { bg: 'var(--warning-light)', color: 'var(--warning)', label: 'Credit Bal ⚠' },
  }
  const s = map[status] ?? { bg: 'var(--bg-elevated)', color: 'var(--text-muted)', label: status ?? '—' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

export default function FinPartyCard({ party, addressRow, isPinned, onClick }) {
  const { party_name, closing_bal, status, party_type } = party
  const mobile    = addressRow?.mobile?.trim() || null
  const stateName = addressRow?.state_name?.trim() || null

  const isNegative = (closing_bal ?? 0) < 0
  const balColor = isNegative
    ? 'var(--error)'
    : status === 'Settled ✓'
    ? 'var(--text-muted)'
    : 'var(--text-primary)'

  return (
    <button
      onClick={onClick}
      className="w-full text-left transition-colors hover:opacity-90 active:opacity-75 animate-fade-in"
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        background: 'transparent',
        cursor: 'pointer',
        minHeight: '44px',
      }}
    >
      {/* Mobile layout */}
      <div className="md:hidden">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {isPinned && (
              <Star size={11} className="flex-shrink-0" style={{ color: 'var(--brand)', fill: 'var(--brand)' }} />
            )}
            <span
              className="font-medium text-sm leading-snug truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {party_name}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="font-mono font-semibold text-sm"
              style={{ color: balColor }}
            >
              {isNegative ? `−${fmt(closing_bal)}` : fmt(closing_bal)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={status} />
          {stateName && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <MapPin size={10} />
              {stateName}
            </span>
          )}
          {mobile && (
            <a
              href={`tel:${mobile}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--brand)' }}
            >
              <Phone size={10} />
              {mobile}
            </a>
          )}
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex items-center gap-4">
        {/* Pin indicator */}
        <div className="w-4 flex-shrink-0">
          {isPinned && (
            <Star size={12} style={{ color: 'var(--brand)', fill: 'var(--brand)' }} />
          )}
        </div>

        {/* Party name */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm truncate block" style={{ color: 'var(--text-primary)' }}>
            {party_name}
          </span>
        </div>

        {/* Status badge */}
        <div className="w-28 flex-shrink-0">
          <StatusBadge status={status} />
        </div>

        {/* State */}
        <div className="w-32 flex-shrink-0">
          {stateName ? (
            <span className="text-xs truncate block" style={{ color: 'var(--text-muted)' }}>
              {stateName}
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--border-strong)' }}>—</span>
          )}
        </div>

        {/* Mobile (tap-to-call) */}
        <div className="w-32 flex-shrink-0">
          {mobile ? (
            <a
              href={`tel:${mobile}`}
              onClick={e => e.stopPropagation()}
              className="text-xs flex items-center gap-1 hover:underline"
              style={{ color: 'var(--brand)' }}
            >
              <Phone size={11} />
              {mobile}
            </a>
          ) : (
            <span className="text-xs" style={{ color: 'var(--border-strong)' }}>—</span>
          )}
        </div>

        {/* Closing balance */}
        <div className="w-32 flex-shrink-0 text-right">
          <span
            className="font-mono font-semibold text-sm"
            style={{ color: balColor }}
          >
            {isNegative ? `−${fmt(closing_bal)}` : fmt(closing_bal)}
          </span>
        </div>
      </div>
    </button>
  )
}
