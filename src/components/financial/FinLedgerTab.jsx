/**
 * FinLedgerTab — Full ledger for one party inside the slide-over.
 * Phase FIN-2
 *
 * Props:
 *   party        — fin_parties row
 *   partyType    — 'debtor' | 'creditor'
 *   fetchLedger  — fn(partyType, partyName) → Promise<rows>
 */
import { useState, useEffect } from 'react'
import Skeleton from '../ui/Skeleton'

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date)) return d
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// A row in the ledger table (desktop)
function LedgerRow({ row, pinned }) {
  const [expanded, setExpanded] = useState(false)
  const narration = row.narration ?? ''

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--border)',
        background: pinned ? 'var(--brand-light)' : 'transparent',
      }}
    >
      <td className="px-3 py-2.5 text-xs whitespace-nowrap font-mono" style={{ color: 'var(--text-muted)' }}>
        {fmtDate(row.txn_date)}
      </td>
      <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        {row.vch_type ?? '—'}
      </td>
      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        {row.vch_no ?? '—'}
      </td>
      <td className="px-3 py-2.5 text-xs max-w-[140px]">
        {narration.length > 40 && !expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="text-left"
            style={{ color: 'var(--text-primary)' }}
          >
            {narration.slice(0, 40)}
            <span style={{ color: 'var(--brand)' }}>… more</span>
          </button>
        ) : (
          <span style={{ color: 'var(--text-primary)' }}>{narration || '—'}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs font-mono text-right" style={{ color: 'var(--error)' }}>
        {(row.debit ?? 0) > 0 ? fmt(row.debit) : ''}
      </td>
      <td className="px-3 py-2.5 text-xs font-mono text-right" style={{ color: 'var(--success)' }}>
        {(row.credit ?? 0) > 0 ? fmt(row.credit) : ''}
      </td>
      <td
        className="px-3 py-2.5 text-xs font-mono text-right font-medium"
        style={{ color: (row.balance ?? 0) < 0 ? 'var(--error)' : 'var(--text-primary)' }}
      >
        {(row.balance ?? 0) < 0 ? `−${fmt(row.balance)}` : fmt(row.balance)}
      </td>
    </tr>
  )
}

// Mobile card layout for one ledger row
function LedgerCard({ row, pinned }) {
  const [expanded, setExpanded] = useState(false)
  const narration = row.narration ?? ''

  return (
    <div
      className="px-4 py-3"
      style={{
        borderBottom: '1px solid var(--border)',
        background: pinned ? 'var(--brand-light)' : 'transparent',
      }}
    >
      {/* Date + vch */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          {fmtDate(row.txn_date)}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {row.vch_type ?? ''} {row.vch_no ?? ''}
        </span>
      </div>
      {/* Narration */}
      {narration && (
        <p className="text-xs mb-2" style={{ color: 'var(--text-primary)' }}>
          {narration.length > 60 && !expanded ? (
            <>
              {narration.slice(0, 60)}
              <button onClick={() => setExpanded(true)} style={{ color: 'var(--brand)' }}>
                … more
              </button>
            </>
          ) : narration}
        </p>
      )}
      {/* Amounts row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-4">
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
        </div>
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

// Skeleton for loading state
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

const COL_HEADERS = ['Date', 'Type', 'Vch No', 'Narration', 'Debit', 'Credit', 'Balance']

export default function FinLedgerTab({ party, partyType, fetchLedger }) {
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [fetched, setFetched] = useState(null) // party name we've fetched for

  useEffect(() => {
    if (!party?.party_name) return
    const key = `${partyType}:${party.party_name}`
    if (fetched === key) return
    setLoading(true)
    setError(null)
    fetchLedger(partyType, party.party_name)
      .then(data => {
        setRows(data)
        setFetched(key)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [party?.party_name, partyType, fetchLedger])

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

  const firstRow = rows[0]
  const lastRow  = rows[rows.length - 1]

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              {COL_HEADERS.map(h => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-xs font-semibold"
                  style={{ color: 'var(--text-muted)' }}
                >
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
                pinned={i === 0 || i === rows.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {rows.map((row, i) => (
          <LedgerCard
            key={row.id ?? i}
            row={row}
            pinned={i === 0 || i === rows.length - 1}
          />
        ))}
      </div>

      {/* Row count footer */}
      <div
        className="px-4 py-2 text-xs text-right"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
      >
        {rows.length.toLocaleString('en-IN')} transactions
      </div>
    </>
  )
}
