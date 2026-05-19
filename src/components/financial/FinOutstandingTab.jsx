/**
 * FinOutstandingTab — Outstanding invoices for one party.
 * Phase FIN-2
 * Phase FIN-7: Added onOutstandingLoaded callback so FinSlideOver can cache rows for Insights tab.
 *
 * Props:
 *   party               — fin_parties row
 *   partyType           — 'debtor' | 'creditor'
 *   fetchOutstanding    — fn(partyType, partyName) → Promise<rows>
 *   onOutstandingLoaded — fn(rows) optional — called after fetch completes
 */
import { useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle } from 'lucide-react'

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date)) return d
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function agingBadge(invDate) {
  if (!invDate) return null
  const days = Math.floor((Date.now() - new Date(invDate).getTime()) / 86400000)
  if (days <= 30)  return { label: `${days}d`, color: 'var(--success)',  bg: 'var(--success-light)' }
  if (days <= 60)  return { label: `${days}d`, color: 'var(--brand)',    bg: 'var(--brand-light)' }
  if (days <= 90)  return { label: `${days}d`, color: 'var(--warning)',  bg: 'var(--warning-light)' }
  return           { label: `${days}d`, color: 'var(--error)',   bg: 'var(--error-light)' }
}

function OutstandingSkeleton() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'var(--border)' }} />
            <div className="h-5 w-12 rounded-full animate-pulse" style={{ background: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-3 rounded animate-pulse" style={{ background: 'var(--border)' }} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function InvoiceRow({ row }) {
  const badge = agingBadge(row.inv_date)
  return (
    <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Top row: date + aging badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {fmtDate(row.inv_date)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {row.vch_type ?? ''} {row.vch_no ?? ''}
          </span>
        </div>
        {badge && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* Amount columns */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="mb-0.5" style={{ color: 'var(--text-muted)' }}>Original</p>
          <p className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
            {fmt(row.original_amt)}
          </p>
        </div>
        <div>
          <p className="mb-0.5" style={{ color: 'var(--text-muted)' }}>Paid</p>
          <p className="font-mono font-medium" style={{ color: 'var(--success)' }}>
            {fmt(row.paid_amt)}
          </p>
        </div>
        <div>
          <p className="mb-0.5" style={{ color: 'var(--text-muted)' }}>Remaining</p>
          <p className="font-mono font-semibold" style={{ color: 'var(--error)' }}>
            {fmt(row.remaining)}
          </p>
        </div>
      </div>

      {/* Reason if present */}
      {row.reason && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {row.reason}
        </p>
      )}
    </div>
  )
}

export default function FinOutstandingTab({ party, partyType, fetchOutstanding, onOutstandingLoaded }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [fetched, setFetched] = useState(null)

  useEffect(() => {
    if (!party?.party_name) return
    const key = `${partyType}:${party.party_name}`
    if (fetched === key) return
    setLoading(true)
    setError(null)
    fetchOutstanding(partyType, party.party_name)
      .then(data => {
        setRows(data)
        setFetched(key)
        if (onOutstandingLoaded) onOutstandingLoaded(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [party?.party_name, partyType, fetchOutstanding])

  if (loading) return <OutstandingSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm" style={{ color: 'var(--error)' }}>Failed to load outstanding</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    )
  }

  const bal = party.closing_bal ?? 0

  // Credit balance state — vendor owes you / excess received
  if (bal < 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: 'var(--warning-light)' }}
        >
          <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />
        </div>
        <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
          Credit Balance
        </p>
        <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
          Excess receipt of {fmt(bal)} — pending adjustment or refund.
        </p>
      </div>
    )
  }

  // Settled state
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: 'var(--success-light)' }}
        >
          <CheckCircle size={20} style={{ color: 'var(--success)' }} />
        </div>
        <p className="font-semibold text-sm mb-1" style={{ color: 'var(--success)' }}>
          All invoices cleared ✓
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          No outstanding invoices for this party.
        </p>
      </div>
    )
  }

  // Outstanding invoices
  const totalRemaining = rows.reduce((s, r) => s + (r.remaining ?? 0), 0)

  return (
    <>
      {/* Summary line */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--error-light)', borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--error)' }}>
          Total outstanding
        </span>
        <div className="text-right">
          <span className="font-mono font-semibold text-sm" style={{ color: 'var(--error)' }}>
            {fmt(totalRemaining)}
          </span>
          <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
            across {rows.length} {rows.length === 1 ? 'invoice' : 'invoices'}
          </span>
        </div>
      </div>

      {/* Invoice list */}
      {rows.map((row, i) => (
        <InvoiceRow key={row.id ?? i} row={row} />
      ))}
    </>
  )
}
