/**
 * FinSearch — Global search across fin_parties + fin_address.
 * Phase FIN-2
 *
 * Props:
 *   open        — bool
 *   onClose     — fn()
 *   debtors     — fin_parties debtor array
 *   creditors   — fin_parties creditor array
 *   addressMap  — Map<lowerName, addressRow>
 *   onSelect    — fn(party) — called with the selected party object
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Fuse from 'fuse.js'
import { Search, X, TrendingUp, TrendingDown, ChevronRight, Clock } from 'lucide-react'

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const STATUS_COLOURS = {
  'Receivable':   { color: 'var(--brand)',   bg: 'var(--brand-light)' },
  'Payable':      { color: 'var(--error)',   bg: 'var(--error-light)' },
  'Settled ✓':   { color: 'var(--success)', bg: 'var(--success-light)' },
  'Credit Bal ⚠': { color: 'var(--warning)', bg: 'var(--warning-light)' },
}

const RECENT_KEY = 'fin_recent_parties'

function getRecent() {
  try {
    return JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? '[]')
  } catch { return [] }
}

function saveRecent(party) {
  try {
    const list = getRecent().filter(p => !(p.party_type === party.party_type && p.party_name === party.party_name))
    const next = [party, ...list].slice(0, 5)
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {}
}

export default function FinSearch({ open, onClose, debtors, creditors, addressMap, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [focusIndex, setFocusIndex] = useState(-1)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Build Fuse index from merged parties + address data
  const fuse = useMemo(() => {
    const all = [...(debtors ?? []), ...(creditors ?? [])]
    const docs = all.map(p => {
      const addr = addressMap?.get(p.party_name.trim().toLowerCase())
      return {
        ...p,
        gstin:      addr?.gstin ?? '',
        mobile:     addr?.mobile ?? '',
        state_name: addr?.state_name ?? '',
      }
    })
    return new Fuse(docs, {
      keys: ['party_name', 'gstin', 'mobile', 'state_name'],
      threshold: 0.35,
      includeScore: true,
      minMatchCharLength: 2,
    })
  }, [debtors, creditors, addressMap])

  // Auto-focus on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setFocusIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  // Search as user types
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const res = fuse.search(query.trim(), { limit: 20 }).map(r => r.item)
    setResults(res)
    setFocusIndex(-1)
  }, [query, fuse])

  // Keyboard navigation + Escape
  useEffect(() => {
    const handler = (e) => {
      if (!open) return
      if (e.key === 'Escape') { onClose(); return }
      const total = query.trim() ? results.length : getRecent().length
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusIndex(i => Math.min(i + 1, total - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && focusIndex >= 0) {
        e.preventDefault()
        const list = query.trim() ? results : getRecent()
        if (list[focusIndex]) handleSelect(list[focusIndex])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, focusIndex, query, onClose])

  const handleSelect = useCallback((party) => {
    saveRecent(party)
    onSelect(party)
    onClose()
  }, [onSelect, onClose])

  if (!open) return null

  const recent = getRecent()
  const showRecent = !query.trim() && recent.length > 0
  const showResults = query.trim() && results.length > 0
  const showEmpty = query.trim() && results.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center"
      style={{ background: 'var(--bg-overlay)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl mx-auto mt-14 rounded-2xl overflow-hidden flex flex-col animate-slide-up"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
          maxHeight: 'calc(100dvh - 7rem)',
          width: 'calc(100% - 2rem)',
        }}
      >
        {/* Search input row */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search party name, GSTIN, mobile, state…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)', fontFamily: '"DM Sans", sans-serif' }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="transition-opacity hover:opacity-70 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Clear"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-1 text-xs px-2 py-1 rounded-lg flex-shrink-0"
            style={{
              color: 'var(--text-muted)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            Esc
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1" ref={listRef}>

          {/* Empty prompt */}
          {!query.trim() && !showRecent && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Search size={28} style={{ color: 'var(--border-strong)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Search debtors and creditors
              </p>
            </div>
          )}

          {/* Recent searches */}
          {showRecent && (
            <>
              <div
                className="flex items-center gap-2 px-4 py-2"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Recent
                </span>
              </div>
              <ul>
                {recent.map((party, idx) => (
                  <PartyRow
                    key={`recent-${party.party_type}-${party.party_name}`}
                    party={party}
                    isFocused={focusIndex === idx}
                    onClick={() => handleSelect(party)}
                    addressMap={addressMap}
                  />
                ))}
              </ul>
            </>
          )}

          {/* Search results */}
          {showResults && (
            <ul>
              {results.map((party, idx) => (
                <PartyRow
                  key={`${party.party_type}-${party.party_name}`}
                  party={party}
                  isFocused={focusIndex === idx}
                  onClick={() => handleSelect(party)}
                  addressMap={addressMap}
                />
              ))}
            </ul>
          )}

          {/* No results */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No results for{' '}
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  "{query}"
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PartyRow({ party, isFocused, onClick, addressMap }) {
  const addr = addressMap?.get(party.party_name?.trim().toLowerCase())
  const sc = STATUS_COLOURS[party.status] ?? { color: 'var(--text-muted)', bg: 'var(--bg-elevated)' }
  const isDebtor = party.party_type === 'debtor'

  return (
    <li>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{
          borderBottom: '1px solid var(--border)',
          background: isFocused ? 'var(--bg-elevated)' : 'transparent',
        }}
      >
        {/* Type icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: sc.bg }}
        >
          {isDebtor
            ? <TrendingUp  size={14} style={{ color: sc.color }} />
            : <TrendingDown size={14} style={{ color: sc.color }} />}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {party.party_name}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: sc.bg, color: sc.color }}
            >
              {party.status}
            </span>
            {addr?.state_name && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {addr.state_name}
              </span>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-sm font-mono font-medium"
            style={{ color: (party.closing_bal ?? 0) < 0 ? 'var(--error)' : 'var(--text-primary)' }}
          >
            {(party.closing_bal ?? 0) < 0 ? `−${fmt(party.closing_bal)}` : fmt(party.closing_bal)}
          </span>
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
      </button>
    </li>
  )
}
