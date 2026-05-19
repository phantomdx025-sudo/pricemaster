/**
 * FinPartyList — sortable and filterable party list.
 * Handles sort controls, filter strip (status + state + hide-settled toggle),
 * and renders FinPartyCard for each party.
 * Phase FIN-3: Bulk PDF export button when filter = 'outstanding'.
 */
import { useState, useMemo, useCallback, useRef } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown, SlidersHorizontal, FileDown, X } from 'lucide-react'
import FinPartyCard from './FinPartyCard'
import { generatePartyPDF } from './FinPdfExport'
import Skeleton from '../ui/Skeleton'
import { toast } from '../ui/Toast'

const SORT_OPTIONS = [
  { id: 'name_asc',  label: 'Name A→Z' },
  { id: 'name_desc', label: 'Name Z→A' },
  { id: 'bal_asc',   label: 'Balance ↑' },
  { id: 'bal_desc',  label: 'Balance ↓' },
]

const FILTER_OPTIONS = [
  { id: 'all',         label: 'All' },
  { id: 'outstanding', label: 'Outstanding' },
  { id: 'Receivable',  label: 'Receivable' },
  { id: 'Payable',     label: 'Payable' },
  { id: 'Settled ✓',   label: 'Settled' },
  { id: 'Credit Bal ⚠', label: 'Credit Bal' },
]

// Desktop column header with sort indicator
function ColHeader({ label, sortKey, currentSort, onSort }) {
  const asc  = currentSort === sortKey + '_asc'
  const desc = currentSort === sortKey + '_desc'
  const active = asc || desc
  return (
    <button
      onClick={() => onSort(asc ? sortKey + '_desc' : sortKey + '_asc')}
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-opacity hover:opacity-70"
      style={{ color: active ? 'var(--brand)' : 'var(--text-muted)' }}
    >
      {label}
      {asc   ? <ChevronUp size={11} />   :
       desc  ? <ChevronDown size={11} /> :
               <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />}
    </button>
  )
}

export default function FinPartyList({
  parties,
  addressMap,
  pinned,
  loading,
  partyType,   // 'debtor' | 'creditor'
  onPartyClick,
  bulkExportHooks,  // { fetchLedger, fetchOutstanding, fetchContact } — from useFinancial
}) {
  const [sort,        setSort]        = useState('name_asc')
  const [filter,      setFilter]      = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [hideSettled, setHideSettled] = useState(false)

  // Bulk export state
  const [bulkExporting,  setBulkExporting]  = useState(false)
  const [bulkProgress,   setBulkProgress]   = useState({ current: 0, total: 0, name: '' })
  const bulkCancelRef = useRef(false)

  // Unique states from address book for parties in this list
  const uniqueStates = useMemo(() => {
    const set = new Set()
    ;(parties ?? []).forEach(p => {
      const row = addressMap.get(p.party_name.trim().toLowerCase())
      if (row?.state_name?.trim()) set.add(row.state_name.trim())
    })
    return ['all', ...Array.from(set).sort()]
  }, [parties, addressMap])

  // Filter + sort
  const displayed = useMemo(() => {
    let list = parties ?? []

    // Status filter
    if (filter === 'outstanding') {
      list = list.filter(p => (p.closing_bal ?? 0) > 0)
    } else if (filter !== 'all') {
      list = list.filter(p => p.status === filter)
    }

    // Hide settled toggle
    if (hideSettled) {
      list = list.filter(p => p.status !== 'Settled ✓')
    }

    // State filter
    if (stateFilter !== 'all') {
      list = list.filter(p => {
        const row = addressMap.get(p.party_name.trim().toLowerCase())
        return row?.state_name?.trim() === stateFilter
      })
    }

    // Sort: pinned parties always float to top, then apply sort within each group
    const pinnedKey = (p) => (pinned.has(`${p.party_type}:${p.party_name}`) ? 0 : 1)

    const comparator = (a, b) => {
      const pinDiff = pinnedKey(a) - pinnedKey(b)
      if (pinDiff !== 0) return pinDiff
      switch (sort) {
        case 'name_asc':  return a.party_name.localeCompare(b.party_name)
        case 'name_desc': return b.party_name.localeCompare(a.party_name)
        case 'bal_asc':   return (a.closing_bal ?? 0) - (b.closing_bal ?? 0)
        case 'bal_desc':  return (b.closing_bal ?? 0) - (a.closing_bal ?? 0)
        default:          return a.party_name.localeCompare(b.party_name)
      }
    }

    return [...list].sort(comparator)
  }, [parties, filter, hideSettled, stateFilter, sort, addressMap, pinned])

  // ── Bulk PDF export ────────────────────────────────────────────────────────
  const handleBulkExport = useCallback(async () => {
    if (!bulkExportHooks) return
    const { fetchLedger, fetchOutstanding, fetchContact } = bulkExportHooks

    // Only outstanding parties
    const targets = displayed.filter(p => (p.closing_bal ?? 0) > 0)
    if (targets.length === 0) {
      toast.error('No outstanding parties to export')
      return
    }

    setBulkExporting(true)
    setBulkProgress({ current: 0, total: targets.length, name: '' })
    bulkCancelRef.current = false

    try {
      // Lazy-load JSZip only when needed
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      for (let i = 0; i < targets.length; i++) {
        if (bulkCancelRef.current) break
        const party = targets[i]
        setBulkProgress({ current: i + 1, total: targets.length, name: party.party_name })

        try {
          const [ledger, outstanding, contact] = await Promise.all([
            fetchLedger(party.party_type, party.party_name),
            fetchOutstanding(party.party_type, party.party_name),
            fetchContact(party.party_name),
          ])
          const blob = await generatePartyPDF(party, ledger, outstanding, contact)
          const safeName = party.party_name.replace(/[^a-zA-Z0-9_\- ]/g, '_')
          zip.file(`${safeName}_statement.pdf`, blob)
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Bulk export skipped:', party.party_name, err.message)
          // Skip this party, continue
        }
      }

      if (bulkCancelRef.current) {
        toast.error('Bulk export cancelled')
        return
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const now     = new Date()
      const stamp   = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const fname   = `outstanding_${partyType}s_${stamp}.zip`
      const url     = URL.createObjectURL(zipBlob)
      const a       = document.createElement('a')
      a.href        = url
      a.download    = fname
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      toast.success(`Exported ${targets.length} statements as ${fname}`)
    } catch (err) {
      toast.error('Bulk export failed: ' + (err.message ?? 'Unknown error'))
    } finally {
      setBulkExporting(false)
      setBulkProgress({ current: 0, total: 0, name: '' })
    }
  }, [displayed, bulkExportHooks, partyType])

  if (loading) {
    return (
      <div className="card" style={{ overflow: 'hidden' }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-3.5 rounded" style={{ width: `${50 + (i % 4) * 10}%` }} />
              <Skeleton className="h-5 w-20 rounded-full ml-auto flex-shrink-0" />
              <Skeleton className="h-3.5 w-20 rounded flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* ── Controls bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Filter chips — horizontally scrollable on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 min-w-0 pb-0.5">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: filter === opt.id ? 'var(--brand)' : 'var(--bg-elevated)',
                color:      filter === opt.id ? 'var(--text-inverse)' : 'var(--text-muted)',
                border:     filter === opt.id ? 'none' : '1px solid var(--border)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Hide Settled toggle */}
        <button
          onClick={() => setHideSettled(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all"
          style={{
            background: hideSettled ? 'var(--brand-light)' : 'var(--bg-elevated)',
            color:      hideSettled ? 'var(--brand)'       : 'var(--text-muted)',
            border:     hideSettled ? '1px solid var(--brand-border)' : '1px solid var(--border)',
          }}
        >
          <SlidersHorizontal size={11} />
          Hide Settled
        </button>
      </div>

      {/* ── Second row: sort + state filter ──────────────────── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Sort selector */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="input-field text-xs"
          style={{ maxWidth: '160px', padding: '6px 10px' }}
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>

        {/* State filter */}
        {uniqueStates.length > 2 && (
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="input-field text-xs"
            style={{ maxWidth: '160px', padding: '6px 10px' }}
          >
            {uniqueStates.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All States' : s}</option>
            ))}
          </select>
        )}

        {/* Bulk export — only when filter is Outstanding and bulkExportHooks provided */}
        {filter === 'outstanding' && bulkExportHooks && displayed.length > 0 && (
          <button
            onClick={handleBulkExport}
            disabled={bulkExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all"
            style={{
              background: 'var(--error-light)',
              color: 'var(--error)',
              border: '1px solid var(--error)',
              opacity: bulkExporting ? 0.6 : 1,
            }}
          >
            <FileDown size={11} />
            Export All Outstanding (PDF)
          </button>
        )}

        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {displayed.length} {displayed.length === 1 ? 'party' : 'parties'}
        </span>
      </div>

      {/* ── Bulk export progress modal ───────────────────────── */}
      {bulkExporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
          style={{ background: 'var(--bg-overlay)' }}>
          <div
            className="rounded-2xl p-6 w-80 mx-4"
            style={{ background: 'var(--bg-surface)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Exporting PDFs…
              </h3>
              <button
                onClick={() => { bulkCancelRef.current = true }}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                aria-label="Cancel export"
              >
                <X size={13} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="rounded-full overflow-hidden mb-3" style={{ background: 'var(--bg-elevated)', height: 6 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  background: 'var(--brand)',
                  width: bulkProgress.total > 0
                    ? `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%`
                    : '0%',
                }}
              />
            </div>

            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Generating {bulkProgress.current} of {bulkProgress.total}
            </p>
            <p
              className="text-xs truncate"
              style={{ color: 'var(--text-muted)' }}
              title={bulkProgress.name}
            >
              {bulkProgress.name || '…'}
            </p>
          </div>
        </div>
      )}

      {/* ── Desktop column headers ───────────────────────────── */}
      <div
        className="hidden md:flex items-center gap-4 px-4 pb-2 mb-1"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="w-4 flex-shrink-0" />
        <div className="flex-1">
          <ColHeader label="Party Name" sortKey="name" currentSort={sort} onSort={setSort} />
        </div>
        <div className="w-28 flex-shrink-0">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Status</span>
        </div>
        <div className="w-32 flex-shrink-0">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>State</span>
        </div>
        <div className="w-32 flex-shrink-0">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Mobile</span>
        </div>
        <div className="w-32 flex-shrink-0 text-right">
          <ColHeader label="Balance" sortKey="bal" currentSort={sort} onSort={setSort} />
        </div>
      </div>

      {/* ── Party list ───────────────────────────────────────── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {displayed.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              No parties match the current filter
            </p>
          </div>
        ) : (
          displayed.map(party => (
            <FinPartyCard
              key={`${party.party_type}:${party.party_name}`}
              party={party}
              addressRow={addressMap.get(party.party_name.trim().toLowerCase())}
              isPinned={pinned.has(`${party.party_type}:${party.party_name}`)}
              onClick={() => onPartyClick(party)}
            />
          ))
        )}
      </div>
    </div>
  )
}
