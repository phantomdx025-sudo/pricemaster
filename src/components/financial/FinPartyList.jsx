/**
 * FinPartyList — sortable and filterable party list.
 * Phase FIN-3: Bulk PDF export button when filter = 'outstanding'.
 * Phase FIN-6 (corrected): Label filter strip on main list; per-party label pills.
 *   - Fetches all party labels on mount (one query for the whole list).
 *   - Label filter strip: All / Checked ✓ / Make Receipt / Send for Checking / Not Reviewed / + custom.
 *   - Tapping a party's label pill opens FinLabelPicker inline.
 *   - Label filter is ADDITIVE with status filter.
 *   - Filter resets to 'all' when partyType changes.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown, SlidersHorizontal, FileDown, X } from 'lucide-react'
import FinPartyCard from './FinPartyCard'
import FinLabelPicker, { SYSTEM_LABELS } from './FinLabelPicker'
import FinLabelManager from './FinLabelManager'
import { generatePartyPDF } from './FinPdfExport'
import Skeleton from '../ui/Skeleton'
import { toast } from '../ui/Toast'

const SORT_OPTIONS = [
  { id: 'name_asc',  label: 'Name A→Z' },
  { id: 'name_desc', label: 'Name Z→A' },
  { id: 'bal_asc',   label: 'Balance ↑' },
  { id: 'bal_desc',  label: 'Balance ↓' },
]

const STATUS_FILTER_OPTIONS = [
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
  partyType,    // 'debtor' | 'creditor'
  onPartyClick,
  bulkExportHooks,  // { fetchLedger, fetchOutstanding, fetchContact }
  hooks,            // { fetchAllPartyLabels, setPartyLabel, fetchCustomLabels, addCustomLabel, deleteCustomLabel }
  // labelMap / onLabelChange lifted to AdminFinancial for slide-over sync
  labelMap,
  onLabelChange,
}) {
  const [sort,        setSort]        = useState('name_asc')
  const [filter,      setFilter]      = useState('all')
  const [labelFilter, setLabelFilter] = useState('__all__')
  const [stateFilter, setStateFilter] = useState('all')
  const [hideSettled, setHideSettled] = useState(false)

  // Custom labels for picker
  const [customLabels,  setCustomLabels]  = useState([])

  // Inline label picker state
  const [pickerParty,   setPickerParty]   = useState(null)
  const [managerOpen,   setManagerOpen]   = useState(false)

  // Bulk export state
  const [bulkExporting,  setBulkExporting]  = useState(false)
  const [bulkProgress,   setBulkProgress]   = useState({ current: 0, total: 0, name: '' })
  const bulkCancelRef = useRef(false)

  // Fetch custom labels on mount
  useEffect(() => {
    if (!hooks?.fetchCustomLabels) return
    hooks.fetchCustomLabels()
      .then(setCustomLabels)
      .catch(err => { if (import.meta.env.DEV) console.warn('fetchCustomLabels:', err.message) })
  }, [hooks])

  // Reset label filter when partyType changes
  useEffect(() => {
    setLabelFilter('__all__')
  }, [partyType])

  // Build label filter options: system + any custom labels that are actually used
  const usedCustomLabelKeys = useMemo(() => {
    if (!labelMap) return new Set()
    const used = new Set()
    for (const v of labelMap.values()) {
      if (v && customLabels.some(c => c.label_key === v)) used.add(v)
    }
    return used
  }, [labelMap, customLabels])

  const labelFilterOptions = useMemo(() => [
    { key: '__all__',            name: 'All' },
    { key: 'checked',            name: 'Checked ✓',        colorHex: '#2ecc71' },
    { key: 'make_receipt',       name: 'Make Receipt',      colorHex: '#e67e22' },
    { key: 'send_for_checking',  name: 'Send for Checking', colorHex: '#3498db' },
    { key: 'not_reviewed',       name: 'Not Reviewed',      colorHex: '#95a5a6' },
    ...customLabels
      .filter(c => usedCustomLabelKeys.has(c.label_key))
      .map(c => ({ key: c.label_key, name: c.label_name, colorHex: c.color_hex })),
  ], [customLabels, usedCustomLabelKeys])

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

    // Label filter (additive)
    if (labelFilter !== '__all__' && labelMap) {
      if (labelFilter === 'not_reviewed') {
        list = list.filter(p => {
          const lk = labelMap.get(p.party_name)
          return !lk || lk === 'not_reviewed'
        })
      } else {
        list = list.filter(p => labelMap.get(p.party_name) === labelFilter)
      }
    }

    // Sort: pinned parties always float to top
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
  }, [parties, filter, hideSettled, stateFilter, labelFilter, labelMap, sort, addressMap, pinned])

  // ── Label picker handlers ───────────────────────────────────────────────────
  const handleLabelSelect = useCallback(async (party, labelKey) => {
    setPickerParty(null)
    if (!hooks?.setPartyLabel) return
    try {
      await hooks.setPartyLabel(party.party_type, party.party_name, labelKey)
      if (onLabelChange) onLabelChange(party.party_type, party.party_name, labelKey)
    } catch (err) {
      toast.error('Failed to save label: ' + (err.message ?? 'Unknown error'))
    }
  }, [hooks, onLabelChange])

  const handleAddCustomLabel = useCallback(async (name, colorHex) => {
    if (!hooks?.addCustomLabel) return
    const newLabel = await hooks.addCustomLabel(name, colorHex)
    setCustomLabels(prev => [...prev, newLabel])
  }, [hooks])

  const handleDeleteCustomLabel = useCallback(async (labelKey) => {
    if (!hooks?.deleteCustomLabel) return
    await hooks.deleteCustomLabel(labelKey)
    setCustomLabels(prev => prev.filter(c => c.label_key !== labelKey))
    // Optimistically remove from label map via onLabelChange for any party using it
    if (onLabelChange && labelMap) {
      for (const [partyName, lk] of labelMap.entries()) {
        if (lk === labelKey) onLabelChange(partyType, partyName, null)
      }
    }
  }, [hooks, onLabelChange, labelMap, partyType])

  // ── Bulk PDF export ─────────────────────────────────────────────────────────
  const handleBulkExport = useCallback(async () => {
    if (!bulkExportHooks) return
    const { fetchLedger, fetchOutstanding, fetchContact } = bulkExportHooks
    const targets = displayed.filter(p => (p.closing_bal ?? 0) > 0)
    if (targets.length === 0) {
      toast.error('No outstanding parties to export')
      return
    }
    setBulkExporting(true)
    setBulkProgress({ current: 0, total: targets.length, name: '' })
    bulkCancelRef.current = false
    try {
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
        }
      }
      if (bulkCancelRef.current) { toast.error('Bulk export cancelled'); return }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const now = new Date()
      const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
      const fname = `outstanding_${partyType}s_${stamp}.zip`
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url; a.download = fname; a.click()
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
      {/* ── Status filter + Hide Settled ──────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0 pb-0.5">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: filter === opt.id ? 'var(--brand)' : 'var(--bg-elevated)',
                color:      filter === opt.id ? 'var(--text-inverse)' : 'var(--text-muted)',
                border:     filter === opt.id ? 'none' : '1px solid var(--border)',
                minHeight:  '36px',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
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

      {/* ── Label filter strip ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 pb-0.5">
        {labelFilterOptions.map(opt => {
          const isActive = labelFilter === opt.key
          const dotColor = opt.colorHex
          return (
            <button
              key={opt.key}
              onClick={() => setLabelFilter(opt.key)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: isActive
                  ? (dotColor ? dotColor + '22' : 'var(--brand-light)')
                  : 'var(--bg-elevated)',
                color: isActive
                  ? (dotColor ?? 'var(--brand)')
                  : 'var(--text-muted)',
                border: isActive
                  ? `1px solid ${dotColor ? dotColor + '66' : 'var(--brand-border)'}`
                  : '1px solid var(--border)',
                minHeight: '30px',
              }}
            >
              {dotColor && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: dotColor, opacity: isActive ? 1 : 0.5 }}
                />
              )}
              {opt.name}
            </button>
          )
        })}
        {/* Manage custom labels */}
        {hooks?.addCustomLabel && (
          <button
            onClick={() => setManagerOpen(true)}
            className="px-2 py-1 rounded-full text-xs flex-shrink-0 transition-all"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              minHeight: '30px',
            }}
            title="Manage custom labels"
          >
            ⚙
          </button>
        )}
      </div>

      {/* ── Second row: sort + state filter + bulk export ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
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

      {/* ── Bulk export progress modal ───────────────────── */}
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
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }} title={bulkProgress.name}>
              {bulkProgress.name || '…'}
            </p>
          </div>
        </div>
      )}

      {/* ── Desktop column headers ───────────────────────── */}
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
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Label</span>
        </div>
        <div className="w-28 flex-shrink-0">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>State</span>
        </div>
        <div className="w-32 flex-shrink-0">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Mobile</span>
        </div>
        <div className="w-32 flex-shrink-0 text-right">
          <ColHeader label="Balance" sortKey="bal" currentSort={sort} onSort={setSort} />
        </div>
      </div>

      {/* ── Party list ───────────────────────────────────── */}
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
              labelKey={labelMap?.get(party.party_name) ?? null}
              customLabels={customLabels}
              onLabelClick={(p) => setPickerParty(p)}
            />
          ))
        )}
      </div>

      {/* ── Inline label picker (per party) ─────────────── */}
      {pickerParty && (
        <FinLabelPicker
          currentLabel={labelMap?.get(pickerParty.party_name) ?? null}
          customLabels={customLabels}
          onSelect={(key) => handleLabelSelect(pickerParty, key)}
          onClose={() => setPickerParty(null)}
          onManage={() => { setPickerParty(null); setManagerOpen(true) }}
        />
      )}

      {/* ── Label manager modal ──────────────────────────── */}
      <FinLabelManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        customLabels={customLabels}
        onAdd={handleAddCustomLabel}
        onDelete={handleDeleteCustomLabel}
      />
    </div>
  )
}
