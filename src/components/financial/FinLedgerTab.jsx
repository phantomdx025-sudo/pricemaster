/**
 * FinLedgerTab — Full ledger for one party.
 * Phase FIN-2: core ledger display.
 * Phase FIN-5: BUG-2 — table-fixed w-full, percentage widths, no narration column on desktop.
 * Phase FIN-6 (corrected): label code removed — labels are per-party on FinPartyList.
 * Phase AX-3 mobile fixes:
 *   - vch_no gets its own dedicated full-width line (mono font, never truncated).
 *   - Narration removed from default view.
 *   - Single "Show narrations" / "Hide narrations" toggle above the list
 *     that reveals/hides narrations for ALL rows simultaneously.
 *
 * Phase AX-5: isLandscape prop — forces desktop table layout on landscape mobile.
 *
 * Props:
 *   party          — fin_parties row
 *   partyType      — 'debtor' | 'creditor'
 *   fetchLedger    — fn(partyType, partyName) → Promise<rows>
 *   onLedgerLoaded — fn(rows) — called after ledger fetch completes
 *   isLandscape    — boolean (default false) — from AdminLedger's orientation detection
 */
import { useState, useEffect } from 'react'

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date)) return d
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Desktop table row — 6 columns (no narration column since FIN-5)
function LedgerRow({ row, highlighted }) {
  return (
    <tr style={{
      borderBottom: '1px solid var(--border)',
      background: highlighted ? 'var(--brand-light)' : 'transparent',
    }}>
      <td className="px-2 py-2.5 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)', width: '14%' }}>
        {fmtDate(row.txn_date)}
      </td>
      <td className="px-2 py-2.5 text-xs" style={{ color: 'var(--text-muted)', width: '22%', maxWidth: 0 }}>
        <span className="block truncate" title={row.vch_type ?? ''}>{row.vch_type ?? '—'}</span>
      </td>
      <td className="px-2 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)', width: '18%', maxWidth: 0 }}>
        <span className="block truncate" title={row.vch_no ?? ''}>{row.vch_no ?? '—'}</span>
      </td>
      <td className="px-2 py-2.5 text-xs font-mono text-right" style={{ color: 'var(--error)', width: '15%' }}>
        {(row.debit ?? 0) > 0 ? fmt(row.debit) : ''}
      </td>
      <td className="px-2 py-2.5 text-xs font-mono text-right" style={{ color: 'var(--success)', width: '15%' }}>
        {(row.credit ?? 0) > 0 ? fmt(row.credit) : ''}
      </td>
      <td className="px-2 py-2.5 text-xs font-mono text-right font-medium"
        style={{ color: (row.balance ?? 0) < 0 ? 'var(--error)' : 'var(--text-primary)', width: '16%' }}>
        {(row.balance ?? 0) < 0 ? `−${fmt(row.balance)}` : fmt(row.balance)}
      </td>
    </tr>
  )
}

// AX-3 Mobile card — vch_no on its own line, narration controlled by showNarrations prop
function LedgerCard({ row, highlighted, showNarrations }) {
  const narration = row.narration ?? ''

  return (
    <div className="px-4 py-3" style={{
      borderBottom: '1px solid var(--border)',
      background: highlighted ? 'var(--brand-light)' : 'transparent',
    }}>
      {/* Row 1: Date + Vch Type */}
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          {fmtDate(row.txn_date)}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {row.vch_type ?? ''}
        </span>
      </div>

      {/* Row 2: Vch No — full-width, mono, never truncated, AX-3 fix */}
      {row.vch_no && (
        <div className="mb-1.5">
          <span
            className="text-xs font-mono block w-full"
            style={{ color: 'var(--text-primary)' }}
          >
            {row.vch_no}
          </span>
        </div>
      )}

      {/* Row 3: Narration — only when showNarrations = true */}
      {showNarrations && narration && (
        <p className="text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          {narration}
        </p>
      )}

      {/* Row 4: Debit / Credit / Balance */}
      <div className="flex items-center gap-3 flex-wrap">
        {(row.debit ?? 0) > 0 && (
          <span className="text-xs font-mono" style={{ color: 'var(--error)' }}>
            Dr {fmt(row.debit)}
          </span>
        )}
        {(row.credit ?? 0) > 0 && (
          <span className="text-xs font-mono" style={{ color: 'var(--success)' }}>
            Cr {fmt(row.credit)}
          </span>
        )}
        <span
          className="text-xs font-mono font-semibold"
          style={{ color: (row.balance ?? 0) < 0 ? 'var(--error)' : 'var(--text-primary)' }}
        >
          Bal: {(row.balance ?? 0) < 0 ? `−${fmt(row.balance)}` : fmt(row.balance)}
        </span>
      </div>
    </div>
  )
}

function LedgerSkeleton() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 w-20 rounded animate-pulse" style={{ background: 'var(--border)' }} />
            <div className="h-3 w-16 rounded animate-pulse" style={{ background: 'var(--border)' }} />
          </div>
          <div className="h-3 w-3/4 rounded animate-pulse" style={{ background: 'var(--border)' }} />
        </div>
      ))}
    </>
  )
}

const COL_HEADERS = ['Date', 'Type', 'Vch No.', 'Debit', 'Credit', 'Balance']

export default function FinLedgerTab({
  party,
  partyType,
  fetchLedger,
  onLedgerLoaded,
  isLandscape = false,
}) {
  const [rows,           setRows]           = useState([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)
  const [fetched,        setFetched]        = useState(null)
  // AX-3: narrations hidden by default — single toggle for all rows
  const [showNarrations, setShowNarrations] = useState(false)

  const partyKey = party?.party_name ? `${partyType}:${party.party_name}` : null

  useEffect(() => {
    if (!party?.party_name) return
    if (fetched === partyKey) return
    setLoading(true)
    setError(null)
    fetchLedger(partyType, party.party_name)
      .then(data => {
        setRows(data)
        setFetched(partyKey)
        if (onLedgerLoaded) onLedgerLoaded(data)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [partyKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LedgerSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm" style={{ color: 'var(--error)' }}>Failed to load ledger</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No transactions found</p>
      </div>
    )
  }

  // Check if any row actually has a narration (so we only show toggle when useful)
  const hasAnyNarration = rows.some(r => r.narration?.trim())

  // AX-5: In landscape mode, always use desktop table regardless of screen width
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  const showTable = isLandscape || isDesktop

  return (
    <>
      {/* Desktop table — shown always on desktop OR when landscape on mobile */}
      <div className={showTable ? 'block' : 'hidden'}>
        <table className="w-full text-sm border-collapse table-fixed">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              {COL_HEADERS.map(h => (
                <th key={h} className="px-2 py-2 text-left text-xs font-semibold whitespace-nowrap"
                  style={{ color: 'var(--text-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <LedgerRow
                key={row.id ?? i}
                row={row}
                highlighted={i === 0 || i === rows.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — hidden when showTable */}
      <div className={showTable ? 'hidden' : 'block'}>
        {/* AX-3: Narration toggle — shown above the list, unobtrusive */}
        {hasAnyNarration && (
          <div
            className="px-4 py-2 flex justify-end"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <button
              onClick={() => setShowNarrations(v => !v)}
              className="text-xs underline"
              style={{ color: 'var(--text-muted)' }}
            >
              {showNarrations ? 'Hide narrations' : 'Show narrations'}
            </button>
          </div>
        )}

        {rows.map((row, i) => (
          <LedgerCard
            key={row.id ?? i}
            row={row}
            highlighted={i === 0 || i === rows.length - 1}
            showNarrations={showNarrations}
          />
        ))}
      </div>

      {/* Row count footer */}
      <div className="px-4 py-2 text-xs text-right"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        {rows.length.toLocaleString('en-IN')} transactions
      </div>
    </>
  )
}
