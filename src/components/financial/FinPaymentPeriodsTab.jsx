/**
 * FinPaymentPeriodsTab — Phase AX-4
 *
 * Shows all debtors/creditors with:
 *   - Days since last payment received (debtors) / made (creditors)
 *   - Currently outstanding amount per party
 *
 * Lives as the 3rd tab in AdminReports.jsx ("Payment Periods").
 * Data comes from useFinancialReports: fetchLastPayments + fetchOutstandingPerParty.
 *
 * Sort options: days since ↓ (default), days since ↑, outstanding ↓, outstanding ↑, name A→Z
 * Filter: days range (All / <30 / 30–60 / 60–90 / >90) + outstanding (All / Has / None)
 * Collapsible filter strip — same FilterDropdown pattern as FinPartyList (AX-3).
 * "Never paid" parties (no payment rows) shown at bottom with "No payments recorded".
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown, ChevronUp, Clock, AlertTriangle,
  ArrowDownUp, Users, Building2, RefreshCw,
} from 'lucide-react'
import { useFinancialReports } from '../../hooks/useFinancialReports'
import Spinner from '../ui/Spinner'

// ── Formatting ──────────────────────────────────────────────────────────────

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function fmtDate(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d)) return isoStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysSince(isoStr) {
  if (!isoStr) return null
  const then = new Date(isoStr)
  if (isNaN(then)) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  then.setHours(0, 0, 0, 0)
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

// ── Days badge colour ────────────────────────────────────────────────────────

function daysBadgeStyle(days) {
  if (days === null)  return { bg: 'var(--error-light)',   color: 'var(--error)' }
  if (days < 30)      return { bg: 'var(--success-light)', color: 'var(--success)' }
  if (days < 60)      return { bg: 'var(--warning-light)', color: 'var(--warning)' }
  if (days < 90)      return { bg: 'rgba(220,130,40,0.15)', color: '#dc8228' }   // orange mid-tone
  return               { bg: 'var(--error-light)',   color: 'var(--error)' }
}

// ── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: 'days_desc',        label: 'Most overdue first'       },
  { id: 'days_asc',         label: 'Least overdue first'      },
  { id: 'outstanding_desc', label: 'Outstanding ↓'            },
  { id: 'outstanding_asc',  label: 'Outstanding ↑'            },
  { id: 'name_asc',         label: 'Name A → Z'               },
]

// ── Days filter options ──────────────────────────────────────────────────────

const DAYS_FILTER_OPTIONS = [
  { id: 'all',    label: 'All'         },
  { id: 'lt30',   label: '< 30 days'   },
  { id: '30_60',  label: '30–60 days'  },
  { id: '60_90',  label: '60–90 days'  },
  { id: 'gt90',   label: '> 90 days'   },
  { id: 'never',  label: 'Never paid'  },
]

// ── Outstanding filter options ───────────────────────────────────────────────

const OST_FILTER_OPTIONS = [
  { id: 'all',     label: 'All'           },
  { id: 'has',     label: 'Has outstanding' },
  { id: 'settled', label: 'Fully settled'   },
]

// ── Collapsible filter dropdown (same pattern as FinPartyList AX-3) ──────────

function FilterDropdown({ id, label, badge, openGroup, setOpenGroup, children }) {
  const ref = useRef(null)
  const isOpen = openGroup === id

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpenGroup(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, setOpenGroup])

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpenGroup(isOpen ? null : id)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
        style={{
          background: isOpen || badge > 0 ? 'var(--brand-light)' : 'var(--bg-elevated)',
          color:      isOpen || badge > 0 ? 'var(--brand)'       : 'var(--text-muted)',
          border:     isOpen || badge > 0 ? '1px solid var(--brand-border)' : '1px solid var(--border)',
          minHeight:  '36px',
        }}
      >
        {label}
        {badge > 0 && (
          <span
            className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none"
            style={{ background: 'var(--brand)', color: 'var(--text-inverse)' }}
          >
            {badge}
          </span>
        )}
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 rounded-xl z-50 animate-fade-in"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: '180px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ── Single party card (mobile) ───────────────────────────────────────────────

function PartyCard({ entry, onNameClick }) {
  const { days, style: badgeStyle } = entry._badge
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      {/* Top row: name + badge */}
      <div className="flex items-start justify-between gap-2">
        {/* BX-2: Tappable party name */}
        <button
          onClick={() => onNameClick(entry.party_name)}
          className="text-sm font-medium leading-snug text-left hover:underline"
          style={{ color: 'var(--brand)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          {entry.party_name}
        </button>
        <span
          className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: badgeStyle.bg, color: badgeStyle.color, whiteSpace: 'nowrap' }}
        >
          {days === null ? 'No payments' : `${days}d`}
        </span>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Last payment</span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {entry.last_payment_date ? fmtDate(entry.last_payment_date) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Outstanding</span>
          <span
            className="text-xs font-semibold"
            style={{ color: entry.outstanding > 0 ? 'var(--error)' : 'var(--success)' }}
          >
            {fmt(entry.outstanding)}
          </span>
        </div>
        {days !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Days since</span>
            <span className="text-xs font-semibold" style={{ color: badgeStyle.color }}>
              {days} days ago
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinPaymentPeriodsTab() {
  const { fetchLastPayments, fetchOutstandingPerParty } = useFinancialReports()
  const navigate = useNavigate() // BX-2: for tappable party names

  // AX-5: Landscape detection for layout adaptation
  const [isLandscape, setIsLandscape] = useState(
    () => window.innerWidth > window.innerHeight
  )
  useEffect(() => {
    const handler = () => setIsLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Party type toggle ──────────────────────────────────────────────────────
  const [partyType, setPartyType] = useState('debtor')

  // ── Data ───────────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState([])   // merged + enriched
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [loaded,  setLoaded]  = useState(false)

  // ── Filters + sort ─────────────────────────────────────────────────────────
  const [openGroup,    setOpenGroup]    = useState(null)
  const [daysFilter,   setDaysFilter]   = useState('all')
  const [ostFilter,    setOstFilter]    = useState('has')
  const [sortKey,      setSortKey]      = useState('days_desc')
  const [query,        setQuery]        = useState('')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef(null)

  // Close sort menu on outside click
  useEffect(() => {
    if (!showSortMenu) return
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSortMenu])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (type) => {
    setLoading(true)
    setError(null)
    try {
      const [payments, outstanding] = await Promise.all([
        fetchLastPayments(type),
        fetchOutstandingPerParty(type),
      ])

      // Build outstanding map
      const ostMap = new Map()
      outstanding.forEach(r => ostMap.set(r.party_name, r.outstanding))

      // Build payments map
      const payMap = new Map()
      payments.forEach(r => payMap.set(r.party_name, r.last_payment_date))

      // All parties = union of both maps
      const allNames = new Set([...payMap.keys(), ...ostMap.keys()])

      const merged = [...allNames].map(name => {
        const last_payment_date = payMap.get(name) ?? null
        const outstanding       = ostMap.get(name) ?? 0
        const days              = daysSince(last_payment_date)
        const bStyle            = daysBadgeStyle(days)
        return {
          party_name: name,
          last_payment_date,
          outstanding,
          days,
          _badge: { days, style: bStyle },
        }
      })

      setEntries(merged)
      setLoaded(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchLastPayments, fetchOutstandingPerParty])

  useEffect(() => {
    load(partyType)
  }, [partyType]) // re-fetch when party type changes

  // ── Filter badges ──────────────────────────────────────────────────────────
  const daysBadgeCount = daysFilter !== 'all' ? 1 : 0
  const ostBadgeCount  = ostFilter  !== 'all' ? 1 : 0

  // ── Computed list ──────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...entries]

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(e => e.party_name.toLowerCase().includes(q))
    }

    // Days filter
    if (daysFilter !== 'all') {
      list = list.filter(e => {
        const d = e.days
        if (daysFilter === 'never')  return d === null
        if (d === null) return false
        if (daysFilter === 'lt30')   return d < 30
        if (daysFilter === '30_60')  return d >= 30 && d < 60
        if (daysFilter === '60_90')  return d >= 60 && d < 90
        if (daysFilter === 'gt90')   return d >= 90
        return true
      })
    }

    // Outstanding filter
    if (ostFilter === 'has')     list = list.filter(e => e.outstanding > 0)
    if (ostFilter === 'settled') list = list.filter(e => e.outstanding <= 0)

    // Sort
    list.sort((a, b) => {
      switch (sortKey) {
        case 'days_desc': {
          // null (never paid) goes to absolute bottom
          if (a.days === null && b.days === null) return 0
          if (a.days === null) return 1
          if (b.days === null) return -1
          return b.days - a.days
        }
        case 'days_asc': {
          if (a.days === null && b.days === null) return 0
          if (a.days === null) return 1
          if (b.days === null) return -1
          return a.days - b.days
        }
        case 'outstanding_desc': return b.outstanding - a.outstanding
        case 'outstanding_asc':  return a.outstanding - b.outstanding
        case 'name_asc':         return a.party_name.localeCompare(b.party_name)
        default: return 0
      }
    })

    return list
  }, [entries, query, daysFilter, ostFilter, sortKey])

  // ── Desktop table styles ───────────────────────────────────────────────────
  const thStyle = {
    background:   'var(--bg-elevated)',
    color:        'var(--text-muted)',
    fontSize:     '11px',
    fontWeight:   600,
    padding:      '8px 12px',
    textAlign:    'right',
    whiteSpace:   'nowrap',
  }
  const thLeftStyle = { ...thStyle, textAlign: 'left' }
  const tdStyle = {
    padding:      '10px 12px',
    fontSize:     '12px',
    color:        'var(--text-primary)',
    borderBottom: '1px solid var(--border)',
    textAlign:    'right',
    whiteSpace:   'nowrap',
  }
  const tdLeftStyle = { ...tdStyle, textAlign: 'left' }

  const sortLabel = SORT_OPTIONS.find(s => s.id === sortKey)?.label ?? 'Sort'

  return (
    <div className="flex flex-col gap-4">

      {/* ── Debtors / Creditors toggle ─────────────────────────── */}
      <div className="flex gap-2 flex-wrap items-center">
        {[
          { id: 'debtor',   label: 'Debtors',   Icon: Users     },
          { id: 'creditor', label: 'Creditors',  Icon: Building2 },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => {
              if (id !== partyType) {
                setPartyType(id)
                setLoaded(false)
                setEntries([])
                setDaysFilter('all')
                setOstFilter('all')
                setQuery('')
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={{
              background: partyType === id ? 'var(--brand)' : 'var(--bg-elevated)',
              color:      partyType === id ? 'var(--text-inverse)' : 'var(--text-muted)',
              border:     partyType === id ? '1px solid var(--brand)' : '1px solid var(--border)',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}

        {/* Refresh */}
        <button
          onClick={() => load(partyType)}
          disabled={loading}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors"
          style={{
            background: 'var(--bg-elevated)',
            color:      'var(--text-muted)',
            border:     '1px solid var(--border)',
          }}
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Filter strip ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Days filter dropdown */}
        <FilterDropdown
          id="days"
          label="Days Overdue"
          badge={daysBadgeCount}
          openGroup={openGroup}
          setOpenGroup={setOpenGroup}
        >
          <div className="py-1.5">
            {DAYS_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => { setDaysFilter(opt.id); setOpenGroup(null) }}
                className="w-full text-left px-4 py-2.5 text-xs flex items-center justify-between transition-colors hover:opacity-80"
                style={{
                  color:      daysFilter === opt.id ? 'var(--brand)' : 'var(--text-secondary)',
                  background: daysFilter === opt.id ? 'var(--brand-light)' : 'transparent',
                  fontWeight: daysFilter === opt.id ? 600 : 400,
                }}
              >
                {opt.label}
                {daysFilter === opt.id && <span style={{ color: 'var(--brand)', fontSize: '10px' }}>✓</span>}
              </button>
            ))}
          </div>
        </FilterDropdown>

        {/* Outstanding filter dropdown */}
        <FilterDropdown
          id="outstanding"
          label="Outstanding"
          badge={ostBadgeCount}
          openGroup={openGroup}
          setOpenGroup={setOpenGroup}
        >
          <div className="py-1.5">
            {OST_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => { setOstFilter(opt.id); setOpenGroup(null) }}
                className="w-full text-left px-4 py-2.5 text-xs flex items-center justify-between transition-colors hover:opacity-80"
                style={{
                  color:      ostFilter === opt.id ? 'var(--brand)' : 'var(--text-secondary)',
                  background: ostFilter === opt.id ? 'var(--brand-light)' : 'transparent',
                  fontWeight: ostFilter === opt.id ? 600 : 400,
                }}
              >
                {opt.label}
                {ostFilter === opt.id && <span style={{ color: 'var(--brand)', fontSize: '10px' }}>✓</span>}
              </button>
            ))}
          </div>
        </FilterDropdown>

        {/* Sort dropdown */}
        <div className="relative flex-shrink-0" ref={sortRef}>
          <button
            onClick={() => setShowSortMenu(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: showSortMenu ? 'var(--brand-light)' : 'var(--bg-elevated)',
              color:      showSortMenu ? 'var(--brand)' : 'var(--text-muted)',
              border:     showSortMenu ? '1px solid var(--brand-border)' : '1px solid var(--border)',
              minHeight:  '36px',
            }}
          >
            <ArrowDownUp size={11} />
            {sortLabel}
            {showSortMenu ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showSortMenu && (
            <div
              className="absolute left-0 top-full mt-1.5 rounded-xl z-50 animate-fade-in"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '180px',
              }}
            >
              <div className="py-1.5">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setSortKey(opt.id); setShowSortMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-xs flex items-center justify-between transition-colors hover:opacity-80"
                    style={{
                      color:      sortKey === opt.id ? 'var(--brand)' : 'var(--text-secondary)',
                      background: sortKey === opt.id ? 'var(--brand-light)' : 'transparent',
                      fontWeight: sortKey === opt.id ? 600 : 400,
                    }}
                  >
                    {opt.label}
                    {sortKey === opt.id && <span style={{ color: 'var(--brand)', fontSize: '10px' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search party…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="rounded-xl px-3 py-2 text-xs outline-none ml-auto"
          style={{
            background: 'var(--bg-elevated)',
            border:     '1px solid var(--border)',
            color:      'var(--text-primary)',
            minWidth:   '160px',
            minHeight:  '36px',
          }}
        />
      </div>

      {/* ── Result count ──────────────────────────────────────────── */}
      {loaded && !loading && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {displayed.length} {partyType === 'debtor' ? 'debtor' : 'creditor'}
          {displayed.length !== 1 ? 's' : ''}
          {(daysFilter !== 'all' || ostFilter !== 'all' || query) ? ' (filtered)' : ''}
        </p>
      )}

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--error-light)', color: 'var(--error)' }}
        >
          Failed to load: {error}
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────────── */}
      {loaded && !loading && displayed.length === 0 && (
        <div
          className="rounded-xl px-4 py-10 text-sm text-center"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          No {partyType === 'debtor' ? 'debtors' : 'creditors'} match the current filters.
        </div>
      )}

      {/* ── Desktop table ─────────────────────────────────────────── */}
      {loaded && !loading && displayed.length > 0 && (() => {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
        const showTable = isLandscape || isDesktop
        return (
          <>
            <div
              className={showTable ? 'block overflow-x-auto rounded-xl' : 'hidden'}
              style={{ border: '1px solid var(--border)' }}
            >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thLeftStyle}>Party Name</th>
                  <th style={thStyle}>Last Payment</th>
                  <th style={thStyle}>Days Since</th>
                  <th style={thStyle}>Outstanding</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(e => {
                  const { days, style: bStyle } = e._badge
                  return (
                    <tr key={e.party_name}>
                      <td style={tdLeftStyle}>
                        {/* BX-2: Tappable party name */}
                        <button
                          onClick={() => navigate(`/admin/financial/ledger/${partyType}/${encodeURIComponent(e.party_name)}`)}
                          className="font-medium text-left hover:underline transition-colors"
                          style={{ color: 'var(--brand)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                        >
                          {e.party_name}
                        </button>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                        {fmtDate(e.last_payment_date)}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: bStyle.color }}>
                        {days !== null ? `${days}d` : '—'}
                      </td>
                      <td style={{
                        ...tdStyle,
                        color: e.outstanding > 0 ? 'var(--error)' : 'var(--success)',
                        fontWeight: 600,
                      }}>
                        {fmt(e.outstanding)}
                      </td>
                      <td style={tdStyle}>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: bStyle.bg, color: bStyle.color }}
                        >
                          {days === null
                            ? 'No payments'
                            : days < 30
                              ? 'Recent'
                              : days < 60
                                ? '30–60d'
                                : days < 90
                                  ? '60–90d'
                                  : '90+ days'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ──────────────────────────────────────── */}
          <div className={showTable ? 'hidden' : 'flex flex-col gap-2'}>
            {displayed.map(e => (
              <PartyCard key={e.party_name} entry={e} onNameClick={(name) => navigate(`/admin/financial/ledger/${partyType}/${encodeURIComponent(name)}`)} />
            ))}
          </div>
        </>
        )
      })()}

    </div>
  )
}
