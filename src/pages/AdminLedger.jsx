/**
 * AdminLedger — Full-screen ledger page for a single party.
 * Phase AX-3: Replaces FinSlideOver when tapping a party from AdminFinancial.
 * Phase AX-5: Landscape mode support — compressed header, table layout at mobile width.
 *
 * Route: /admin/financial/ledger/:partyType/:partyName
 * - partyType = 'debtor' | 'creditor'
 * - partyName = URL-encoded party name
 *
 * Does NOT use the AdminPanel sidebar. Has its own minimal header with a back button.
 * Reuses FinLedgerTab, FinOutstandingTab, FinContactTab, FinInsightsTab exactly.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Star, Share2, Download, MessageCircle, Mail, Printer,
  Loader2, BookOpen, AlertCircle, Phone, BarChart2, Tag,
} from 'lucide-react'
import { useFinancial } from '../hooks/useFinancial'
import { fetchEntityName, fetchPdfBreakdownSetting } from '../hooks/useAppSettings'
import FinLedgerTab      from '../components/financial/FinLedgerTab'
import FinOutstandingTab from '../components/financial/FinOutstandingTab'
import FinContactTab     from '../components/financial/FinContactTab'
import FinInsightsTab    from '../components/financial/FinInsightsTab'
import FinLabelPicker, { SYSTEM_LABELS } from '../components/financial/FinLabelPicker'
import FinLabelManager   from '../components/financial/FinLabelManager'
import { generatePartyPDF } from '../components/financial/FinPdfExport'
import Spinner from '../components/ui/Spinner'
import { toast } from '../components/ui/Toast'

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const STATUS_COLOURS = {
  'Receivable':    { color: 'var(--brand)',   bg: 'var(--brand-light)' },
  'Payable':       { color: 'var(--error)',   bg: 'var(--error-light)' },
  'Settled ✓':    { color: 'var(--success)', bg: 'var(--success-light)' },
  'Credit Bal ⚠':  { color: 'var(--warning)', bg: 'var(--warning-light)' },
}

const TABS = [
  { id: 'ledger',      label: 'Ledger',      Icon: BookOpen },
  { id: 'outstanding', label: 'Outstanding', Icon: AlertCircle },
  { id: 'contact',     label: 'Contact',     Icon: Phone },
  { id: 'insights',    label: 'Insights',    Icon: BarChart2 },
]

export default function AdminLedger() {
  const { partyType, partyName } = useParams()
  const navigate = useNavigate()

  const decodedName = decodeURIComponent(partyName ?? '')

  // Load financial data (need debtors/creditors to find party row + hooks)
  const fin = useFinancial()
  const {
    debtors, creditors, pinned, loading: finLoading,
    fetchLedger, fetchOutstanding, fetchContact, fetchNotes,
    addNote, deleteNote, togglePin,
    fetchPartyLabel, setPartyLabel, fetchCustomLabels, addCustomLabel, deleteCustomLabel,
    loadAll,
  } = fin

  // AX-5: Landscape detection — switches ledger to table layout even on mobile
  const [isLandscape, setIsLandscape] = useState(
    () => window.innerWidth > window.innerHeight
  )
  useEffect(() => {
    const handler = () => setIsLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const [activeTab,         setActiveTab]         = useState('ledger')
  const [pinLoading,        setPinLoading]        = useState(false)
  const [shareOpen,         setShareOpen]         = useState(false)
  const [pdfLoading,        setPdfLoading]        = useState(false)
  const [entityName,        setEntityName]        = useState('ANKxIOUS')
  const [waMode,            setWaMode]            = useState(false)
  const [waNumber,          setWaNumber]          = useState('')
  const [waLoading,         setWaLoading]         = useState(false)
  const [labelOpen,         setLabelOpen]         = useState(false)
  const [customLabels,      setCustomLabels]      = useState([])
  const [managerOpen,       setManagerOpen]       = useState(false)
  const [partyLabelKey,     setPartyLabelKey]     = useState(null)
  const [cachedLedger,      setCachedLedger]      = useState([])
  const [cachedOutstanding, setCachedOutstanding] = useState([])

  const shareRef = useRef(null)

  // Load data on mount
  useEffect(() => { loadAll() }, [loadAll])

  // Fetch entity name for PDF
  useEffect(() => {
    fetchEntityName().then(setEntityName)
  }, [])

  // Fetch label for this party
  useEffect(() => {
    if (!decodedName || !fetchPartyLabel) return
    fetchPartyLabel(partyType, decodedName)
      .then(setPartyLabelKey)
      .catch(() => {})
  }, [decodedName, partyType, fetchPartyLabel])

  // Fetch custom labels for picker
  useEffect(() => {
    if (!fetchCustomLabels) return
    fetchCustomLabels()
      .then(setCustomLabels)
      .catch(err => { if (import.meta.env.DEV) console.warn('fetchCustomLabels:', err.message) })
  }, [fetchCustomLabels])

  // Close share sheet on outside click
  useEffect(() => {
    if (!shareOpen) return
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShareOpen(false)
        setWaMode(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [shareOpen])

  // Find the party row from loaded data
  const list = partyType === 'creditor' ? creditors : debtors
  const party = list.find(p => p.party_name === decodedName) ?? null

  // Back navigation — go to previous page in history (Reports, Financial, wherever)
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/admin', { state: { section: 'financial' } })
    }
  }

  // ── PDF helpers ─────────────────────────────────────────────────────────────
  const buildPDF = useCallback(async () => {
    if (!party) return null
    setPdfLoading(true)
    try {
      const [ledger, outstanding, contact, pdfBreakdown] = await Promise.all([
        fetchLedger(partyType, decodedName),
        fetchOutstanding(partyType, decodedName),
        fetchContact(decodedName),
        fetchPdfBreakdownSetting(),
      ])
      return await generatePartyPDF(party, ledger, outstanding, contact, entityName, { includeOutstandingBreakdown: pdfBreakdown })
    } catch (err) {
      toast.error('PDF generation failed: ' + (err.message ?? 'Unknown error'))
      return null
    } finally {
      setPdfLoading(false)
    }
  }, [party, partyType, decodedName, fetchLedger, fetchOutstanding, fetchContact, entityName])

  const handleDownload = useCallback(async () => {
    setShareOpen(false); setWaMode(false)
    const blob = await buildPDF()
    if (!blob) return
    const safeName = decodedName.replace(/[^a-zA-Z0-9_\- ]/g, '_')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${safeName}_statement.pdf`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }, [buildPDF, decodedName])

  const handleWhatsAppClick = useCallback(async () => {
    let mobile = ''
    try {
      const contact = await fetchContact(decodedName)
      if (contact?.mobile) mobile = contact.mobile.replace(/\D/g, '').slice(-10)
    } catch (_) {}
    setWaNumber(mobile)
    setWaMode(true)
  }, [decodedName, fetchContact])

  const handleWhatsAppSend = useCallback(async () => {
    const digits = waNumber.replace(/\D/g, '')
    if (!digits || digits.length < 10) { toast.error('Enter a valid 10-digit mobile number'); return }
    setWaLoading(true)
    const blob = await buildPDF()
    setWaLoading(false)
    if (!blob) return
    const safeName = decodedName.replace(/[^a-zA-Z0-9_\- ]/g, '_')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${safeName}_statement.pdf`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    const msg = encodeURIComponent(`Dear ${decodedName},\n\nPlease find your account statement attached.\n\nThank you.`)
    window.open(`https://wa.me/91${digits}?text=${msg}`, '_blank', 'noopener')
    setShareOpen(false); setWaMode(false)
  }, [waNumber, buildPDF, decodedName])

  const handleEmail = useCallback(async () => {
    setShareOpen(false); setWaMode(false)
    let email = null
    try { const c = await fetchContact(decodedName); email = c?.email?.trim() ?? null } catch (_) {}
    if (!email) { toast.error('No email address on file for this party'); return }
    const blob = await buildPDF()
    if (!blob) return
    const safeName = decodedName.replace(/[^a-zA-Z0-9_\- ]/g, '_')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${safeName}_statement.pdf`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    const subject = encodeURIComponent(`Account Statement — ${decodedName}`)
    const body = encodeURIComponent(`Dear ${decodedName},\n\nPlease find your account statement attached.\n\nThank you.`)
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }, [buildPDF, decodedName, fetchContact])

  const handlePrint = useCallback(async () => {
    setShareOpen(false); setWaMode(false)
    const blob = await buildPDF()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;'
    iframe.src = url
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url) }, 3000)
    }
  }, [buildPDF])

  // ── Pin ──────────────────────────────────────────────────────────────────────
  const handlePin = useCallback(async () => {
    if (!party || pinLoading) return
    setPinLoading(true)
    try { await togglePin(partyType, decodedName) }
    catch (err) { toast.error('Pin failed: ' + (err.message ?? 'Unknown error')) }
    finally { setPinLoading(false) }
  }, [party, partyType, decodedName, pinLoading, togglePin])

  // ── Label ────────────────────────────────────────────────────────────────────
  const handleLabelSelect = useCallback(async (labelKey) => {
    setLabelOpen(false)
    if (!setPartyLabel) return
    try {
      await setPartyLabel(partyType, decodedName, labelKey)
      setPartyLabelKey(labelKey)
    } catch (err) {
      toast.error('Failed to save label: ' + (err.message ?? 'Unknown error'))
    }
  }, [partyType, decodedName, setPartyLabel])

  const handleAddCustomLabel = useCallback(async (name, colorHex) => {
    if (!addCustomLabel) return
    const newLabel = await addCustomLabel(name, colorHex)
    setCustomLabels(prev => [...prev, newLabel])
  }, [addCustomLabel])

  const handleDeleteCustomLabel = useCallback(async (labelKey) => {
    if (!deleteCustomLabel) return
    await deleteCustomLabel(labelKey)
    setCustomLabels(prev => prev.filter(c => c.label_key !== labelKey))
  }, [deleteCustomLabel])

  // ── Loading state (while fin data loads) ────────────────────────────────────
  const isDataLoading = finLoading && !party

  if (isDataLoading) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center"
        style={{ background: 'var(--bg-base)' }}
      >
        <Spinner size={32} />
      </div>
    )
  }

  // Party not found after data loaded
  if (!finLoading && !party) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg-base)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Party not found: {decodedName}</p>
        <button onClick={handleBack} className="btn-ghost text-xs flex items-center gap-1.5">
          <ArrowLeft size={13} /> Back
        </button>
      </div>
    )
  }

  const isPinned = pinned.has(`${partyType}:${decodedName}`)
  const sc = STATUS_COLOURS[party?.status] ?? { color: 'var(--text-muted)', bg: 'var(--bg-elevated)' }
  const bal = party?.closing_bal ?? 0
  const balFormatted = bal < 0 ? `−${fmt(bal)}` : fmt(bal)

  // Label display
  const sys = SYSTEM_LABELS.find(l => l.key === partyLabelKey)
  const custom = customLabels.find(c => c.label_key === partyLabelKey)
  const labelDisplay = sys ?? (custom ? { name: custom.label_name, colorHex: custom.color_hex } : null)

  const hooks = {
    fetchLedger, fetchOutstanding, fetchContact,
    fetchNotes, addNote, deleteNote, togglePin,
    partyLabelKey,
  }

  return (
    <div
      className={['min-h-dvh flex flex-col', isLandscape ? 'landscape-compact' : ''].join(' ')}
      style={{ background: 'var(--bg-base)' }}
    >
      {/* ── Minimal header ─────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pt-safe-top"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <div className="max-w-3xl mx-auto">
          {/* AX-5: In landscape, collapse party name + status + tabs into a more
              compact layout. Portrait keeps the original two-row layout. */}
          <div className={['flex items-start gap-3', isLandscape ? 'py-1.5 landscape-compact-header' : 'py-3'].join(' ')}>
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-xs flex-shrink-0 transition-opacity hover:opacity-70"
              style={{ color: 'var(--brand)', minHeight: '36px', paddingTop: '2px' }}
              aria-label="Go back"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Financial</span>
            </button>

            {/* Party name + chips */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ background: sc.bg, color: sc.color }}
                >
                  {party?.status}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  {partyType === 'debtor' ? 'Debtor' : 'Creditor'}
                </span>
              </div>
              <h1
                className="font-display font-semibold text-lg leading-snug truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {decodedName}
              </h1>
            </div>

            {/* Share + Pin buttons */}
            <div className="flex items-center gap-1 flex-shrink-0" ref={shareRef}>
              {/* Share */}
              <div className="relative">
                <button
                  onClick={() => { if (!pdfLoading) { setShareOpen(v => !v); setWaMode(false) } }}
                  disabled={pdfLoading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                  style={{
                    background: shareOpen ? 'var(--brand-light)' : 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                  }}
                  aria-label="Share / Export PDF"
                >
                  {pdfLoading
                    ? <Loader2 size={16} style={{ color: 'var(--brand)' }} className="animate-spin" />
                    : <Share2 size={15} style={{ color: shareOpen ? 'var(--brand)' : 'var(--text-muted)' }} />
                  }
                </button>

                {/* Share popover */}
                {shareOpen && !pdfLoading && (
                  <>
                    <div
                      className="fixed inset-0 z-[60] md:hidden"
                      style={{ background: 'var(--bg-overlay)' }}
                      onClick={() => { setShareOpen(false); setWaMode(false) }}
                    />
                    <div
                      className={[
                        'z-[61] animate-fade-in',
                        'md:absolute md:right-0 md:top-full md:mt-2 md:w-64 md:rounded-xl md:shadow-lg',
                        'fixed bottom-0 inset-x-0 rounded-t-2xl md:rounded-xl',
                      ].join(' ')}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-lg)',
                      }}
                    >
                      <div className="flex justify-center pt-3 pb-1 md:hidden">
                        <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
                      </div>
                      <div className="p-2">
                        {waMode ? (
                          <div className="px-3 py-2">
                            <button
                              onClick={() => setWaMode(false)}
                              className="flex items-center gap-1.5 text-xs mb-3"
                              style={{ color: 'var(--brand)' }}
                            >
                              <ArrowLeft size={12} /> Back
                            </button>
                            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Send via WhatsApp</p>
                            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>PDF will download simultaneously.</p>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="flex-shrink-0 text-xs font-mono px-2 py-2 rounded-lg"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                +91
                              </span>
                              <input
                                type="tel" inputMode="numeric" maxLength={10}
                                value={waNumber}
                                onChange={e => setWaNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="10-digit number"
                                className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', minHeight: '44px' }}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleWhatsAppSend() }}
                              />
                            </div>
                            <button onClick={handleWhatsAppSend} disabled={waLoading}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold"
                              style={{ background: '#25d366', color: '#fff', minHeight: '44px', opacity: waLoading ? 0.6 : 1 }}>
                              {waLoading ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                              {waLoading ? 'Generating PDF…' : 'Open WhatsApp'}
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs font-semibold px-3 py-1.5 mb-1" style={{ color: 'var(--text-muted)' }}>Export / Share</p>
                            {[
                              { label: 'Download PDF', sub: 'Save to device', icon: <Download size={14} style={{ color: 'var(--brand)' }} />, bg: 'var(--brand-light)', fn: handleDownload },
                              { label: 'WhatsApp', sub: 'Send via WhatsApp', icon: <MessageCircle size={14} style={{ color: '#2e7d46' }} />, bg: '#d4f0dd', fn: handleWhatsAppClick },
                              { label: 'Email', sub: 'Open mail client', icon: <Mail size={14} style={{ color: 'var(--error)' }} />, bg: 'var(--error-light)', fn: handleEmail },
                              { label: 'Print', sub: 'Print statement', icon: <Printer size={14} style={{ color: 'var(--text-muted)' }} />, bg: 'var(--bg-elevated)', fn: handlePrint, border: '1px solid var(--border)' },
                            ].map(item => (
                              <button key={item.label} onClick={item.fn}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
                                style={{ color: 'var(--text-primary)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: item.bg, border: item.border }}>
                                  {item.icon}
                                </div>
                                <div>
                                  <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
                                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.sub}</div>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                      <div className="h-4 md:hidden" />
                    </div>
                  </>
                )}
              </div>

              {/* Pin */}
              <button onClick={handlePin} disabled={pinLoading}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: isPinned ? 'var(--brand-light)' : 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                aria-label={isPinned ? 'Unpin party' : 'Pin party'}
              >
                <Star size={16} fill={isPinned ? 'var(--brand)' : 'none'} style={{ color: isPinned ? 'var(--brand)' : 'var(--text-muted)' }} />
              </button>
            </div>
          </div>

          {/* Balance row + label pill */}
          <div className={['flex items-center gap-3 flex-wrap', isLandscape ? 'pb-1.5' : 'pb-3'].join(' ')}>
            <span
              className="font-mono font-semibold text-2xl"
              style={{ color: bal < 0 ? 'var(--error)' : 'var(--text-primary)' }}
            >
              {balFormatted}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>closing balance</span>

            {/* Label pill */}
            <div className="relative ml-auto">
              <button
                onClick={() => setLabelOpen(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                style={labelDisplay ? {
                  background: labelDisplay.colorHex + '22',
                  color: labelDisplay.colorHex,
                  border: `1px solid ${labelDisplay.colorHex}44`,
                } : {
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
                aria-label="Set label"
              >
                <Tag size={11} />
                {labelDisplay ? labelDisplay.name : 'Label'}
              </button>
              {labelOpen && (
                <FinLabelPicker
                  currentLabel={partyLabelKey}
                  customLabels={customLabels}
                  onSelect={handleLabelSelect}
                  onClose={() => setLabelOpen(false)}
                  onManage={() => { setLabelOpen(false); setManagerOpen(true) }}
                />
              )}
            </div>
          </div>

          {/* Tab strip */}
          <div className="flex" style={{ marginBottom: '-1px' }}>
            {TABS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors"
                  style={{
                    color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                    borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                  }}
                >
                  <Icon size={13} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-3xl mx-auto">
          {activeTab === 'ledger' && (
            <FinLedgerTab
              party={party}
              partyType={partyType}
              fetchLedger={fetchLedger}
              onLedgerLoaded={setCachedLedger}
              isLandscape={isLandscape}
            />
          )}
          {activeTab === 'outstanding' && (
            <FinOutstandingTab
              party={party}
              partyType={partyType}
              fetchOutstanding={fetchOutstanding}
              onOutstandingLoaded={setCachedOutstanding}
              isLandscape={isLandscape}
            />
          )}
          {activeTab === 'contact' && (
            <FinContactTab
              party={party}
              partyType={partyType}
              fetchContact={fetchContact}
              fetchNotes={fetchNotes}
              addNote={addNote}
              deleteNote={deleteNote}
            />
          )}
          {activeTab === 'insights' && (
            <FinInsightsTab
              party={party}
              partyType={partyType}
              ledgerRows={cachedLedger}
              outstandingRows={cachedOutstanding}
              fetchLedger={fetchLedger}
              fetchOutstanding={fetchOutstanding}
              onLedgerLoaded={setCachedLedger}
            />
          )}
        </div>
      </div>

      {/* Label manager modal */}
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