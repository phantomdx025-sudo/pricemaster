/**
 * FinSlideOver — Slide-in panel showing party details.
 * Phase FIN-2: Core slide-over with Ledger / Outstanding / Contact tabs.
 * Phase FIN-3: Share button + share sheet (Download, WhatsApp, Email, Print).
 * Phase FIN-5: BUG-2 — widen desktop panel to 600px.
 *              BUG-4 — WhatsApp with custom number inline input.
 * Phase FIN-6 (corrected): Label picker in slide-over header (per-party). cachedLedger for FIN-7.
 * Phase FIN-7: Add Insights tab (4th tab) — FinInsightsTab.
 *
 * Props:
 *   party       — fin_parties row (or null when closed)
 *   partyType   — 'debtor' | 'creditor'
 *   onClose     — fn()
 *   pinned      — Set<'type:name'>
 *   hooks       — { fetchLedger, fetchOutstanding, fetchContact, fetchNotes, addNote, deleteNote,
 *                   togglePin, fetchPartyLabel, setPartyLabel, fetchCustomLabels, addCustomLabel, deleteCustomLabel }
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Star, BookOpen, AlertCircle, Phone, Share2, Download, MessageCircle, Mail, Printer, Loader2, ArrowLeft, BarChart2, Tag } from 'lucide-react'
import FinLedgerTab      from './FinLedgerTab'
import FinOutstandingTab from './FinOutstandingTab'
import FinContactTab     from './FinContactTab'
import FinInsightsTab    from './FinInsightsTab'
import FinLabelPicker, { SYSTEM_LABELS } from './FinLabelPicker'
import FinLabelManager from './FinLabelManager'
import { generatePartyPDF } from './FinPdfExport'
import { fetchEntityName } from '../../hooks/useAppSettings'
import { toast } from '../ui/Toast'

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const STATUS_COLOURS = {
  'Receivable':   { color: 'var(--brand)',   bg: 'var(--brand-light)' },
  'Payable':      { color: 'var(--error)',   bg: 'var(--error-light)' },
  'Settled ✓':   { color: 'var(--success)', bg: 'var(--success-light)' },
  'Credit Bal ⚠': { color: 'var(--warning)', bg: 'var(--warning-light)' },
}

const TABS = [
  { id: 'ledger',      label: 'Ledger',      Icon: BookOpen },
  { id: 'outstanding', label: 'Outstanding', Icon: AlertCircle },
  { id: 'contact',     label: 'Contact',     Icon: Phone },
  { id: 'insights',   label: 'Insights',    Icon: BarChart2 },
]

export default function FinSlideOver({ party, partyType, onClose, pinned, hooks }) {
  const [activeTab,    setActiveTab]    = useState('ledger')
  const [pinLoading,   setPinLoading]   = useState(false)
  const [shareOpen,    setShareOpen]    = useState(false)
  const [pdfLoading,   setPdfLoading]   = useState(false)
  const [entityName,   setEntityNameState] = useState('ANKxIOUS')
  // BUG-4: WhatsApp custom number state
  const [waMode,       setWaMode]       = useState(false)
  const [waNumber,     setWaNumber]     = useState('')
  const [waLoading,    setWaLoading]    = useState(false)
  // FIN-6 (corrected): label picker in header
  const [labelOpen,       setLabelOpen]       = useState(false)
  const [customLabels,    setCustomLabels]    = useState([])
  const [managerOpen,     setManagerOpen]     = useState(false)

  // FIN-6 / FIN-7: cache loaded ledger rows so Insights tab can use them without re-fetching
  const [cachedLedger,      setCachedLedger]      = useState([])
  // FIN-7: cache outstanding rows too
  const [cachedOutstanding, setCachedOutstanding] = useState([])

  const shareRef = useRef(null)

  // Close share sheet when clicking outside
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

  // Fetch entity name for PDF on mount
  useEffect(() => {
    fetchEntityName().then(setEntityNameState)
  }, [])

  // Helper: fetch all data needed for PDF then generate
  const buildPDF = useCallback(async () => {
    if (!party) return null
    setPdfLoading(true)
    try {
      const [ledger, outstanding, contact] = await Promise.all([
        hooks.fetchLedger(party.party_type ?? partyType, party.party_name),
        hooks.fetchOutstanding(party.party_type ?? partyType, party.party_name),
        hooks.fetchContact(party.party_name),
      ])
      const blob = await generatePartyPDF(party, ledger, outstanding, contact, entityName)
      return blob
    } catch (err) {
      toast.error('PDF generation failed: ' + (err.message ?? 'Unknown error'))
      return null
    } finally {
      setPdfLoading(false)
    }
  }, [party, partyType, hooks])

  const handleDownload = useCallback(async () => {
    setShareOpen(false)
    setWaMode(false)
    const blob = await buildPDF()
    if (!blob) return
    const safeName = (party?.party_name ?? 'statement').replace(/[^a-zA-Z0-9_\- ]/g, '_')
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = `${safeName}_statement.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }, [buildPDF, party])

  // BUG-4: When WhatsApp option is tapped, switch to number-input mode instead of
  // immediately opening WhatsApp. Pre-fill with party's mobile if available.
  const handleWhatsAppClick = useCallback(async () => {
    // Pre-fetch contact to pre-fill mobile
    let mobile = ''
    try {
      const contact = await hooks.fetchContact(party?.party_name ?? '')
      if (contact?.mobile) {
        mobile = contact.mobile.replace(/\D/g, '').slice(-10) // last 10 digits
      }
    } catch (_) {}
    setWaNumber(mobile)
    setWaMode(true)
  }, [party, hooks])

  // BUG-4: Actually open WhatsApp with the entered number
  const handleWhatsAppSend = useCallback(async () => {
    const digits = waNumber.replace(/\D/g, '')
    if (!digits || digits.length < 10) {
      toast.error('Enter a valid 10-digit mobile number')
      return
    }

    setWaLoading(true)
    // Download PDF simultaneously
    const blob = await buildPDF()
    setWaLoading(false)
    if (!blob) return

    const safeName = (party?.party_name ?? 'statement').replace(/[^a-zA-Z0-9_\- ]/g, '_')
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = `${safeName}_statement.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)

    const msg = encodeURIComponent(
      `Dear ${party?.party_name ?? 'Sir/Madam'},\n\nPlease find your account statement attached.\n\nThank you.`
    )
    window.open(`https://wa.me/91${digits}?text=${msg}`, '_blank', 'noopener')

    setShareOpen(false)
    setWaMode(false)
  }, [waNumber, buildPDF, party])

  const handleEmail = useCallback(async () => {
    setShareOpen(false)
    setWaMode(false)
    let email = null
    try {
      const contact = await hooks.fetchContact(party?.party_name ?? '')
      email = contact?.email?.trim() ?? null
    } catch (_) {}

    if (!email) {
      toast.error('No email address on file for this party')
      return
    }

    // Download PDF simultaneously
    const blob = await buildPDF()
    if (!blob) return

    const safeName = (party?.party_name ?? 'statement').replace(/[^a-zA-Z0-9_\- ]/g, '_')
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = `${safeName}_statement.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)

    const subject = encodeURIComponent(`Account Statement — ${party?.party_name ?? ''}`)
    const body    = encodeURIComponent(
      `Dear ${party?.party_name ?? 'Sir/Madam'},\n\nPlease find your account statement attached.\n\nThank you.`
    )
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }, [buildPDF, party, hooks])

  const handlePrint = useCallback(async () => {
    setShareOpen(false)
    setWaMode(false)
    const blob = await buildPDF()
    if (!blob) return

    const url    = URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.top      = '-9999px'
    iframe.style.left     = '-9999px'
    iframe.style.width    = '1px'
    iframe.style.height   = '1px'
    iframe.src = url
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
        URL.revokeObjectURL(url)
      }, 3000)
    }
  }, [buildPDF])

  const isPinned = party
    ? (pinned?.has(`${party.party_type ?? partyType}:${party.party_name}`) ?? false)
    : false

  // Reset tab + close share when party changes
  useEffect(() => {
    if (party) {
      setActiveTab('ledger')
      setShareOpen(false)
      setWaMode(false)
      setLabelOpen(false)
      setCachedLedger([])
      setCachedOutstanding([])
    }
  }, [party?.party_name])

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (party) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [!!party])

  // Load custom labels for the label picker
  useEffect(() => {
    if (!party || !hooks?.fetchCustomLabels) return
    hooks.fetchCustomLabels()
      .then(setCustomLabels)
      .catch(err => { if (import.meta.env.DEV) console.warn('fetchCustomLabels:', err.message) })
  }, [party?.party_name]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLabelSelect = useCallback(async (labelKey) => {
    setLabelOpen(false)
    if (!hooks?.setPartyLabel || !party) return
    try {
      await hooks.setPartyLabel(party.party_type ?? partyType, party.party_name, labelKey)
      if (hooks.onLabelChange) hooks.onLabelChange(party.party_type ?? partyType, party.party_name, labelKey)
    } catch (err) {
      toast.error('Failed to save label: ' + (err.message ?? 'Unknown error'))
    }
  }, [party, partyType, hooks])

  const handleAddCustomLabel = useCallback(async (name, colorHex) => {
    if (!hooks?.addCustomLabel) return
    const newLabel = await hooks.addCustomLabel(name, colorHex)
    setCustomLabels(prev => [...prev, newLabel])
  }, [hooks])

  const handleDeleteCustomLabel = useCallback(async (labelKey) => {
    if (!hooks?.deleteCustomLabel) return
    await hooks.deleteCustomLabel(labelKey)
    setCustomLabels(prev => prev.filter(c => c.label_key !== labelKey))
  }, [hooks])

  const handlePin = useCallback(async () => {
    if (!party || pinLoading) return
    setPinLoading(true)
    try {
      await hooks.togglePin(party.party_type ?? partyType, party.party_name)
    } catch (err) {
      toast.error('Pin failed: ' + (err.message ?? 'Unknown error'))
    } finally {
      setPinLoading(false)
    }
  }, [party, partyType, pinLoading, hooks])

  if (!party) return null

  const sc = STATUS_COLOURS[party.status] ?? { color: 'var(--text-muted)', bg: 'var(--bg-elevated)' }
  const bal = party.closing_bal ?? 0
  const balFormatted = bal < 0 ? `−${fmt(bal)}` : fmt(bal)
  const type = party.party_type ?? partyType

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 animate-fade-in"
        style={{ background: 'var(--bg-overlay)' }}
        onClick={onClose}
      />

      {/* Panel — right on desktop (BUG-2: widened to 600px), bottom on mobile */}
      <div
        className={[
          'fixed z-50 flex flex-col',
          // Desktop: right panel — BUG-2 fix: was md:w-[480px], now md:w-[600px]
          'md:inset-y-0 md:right-0 md:w-[600px] md:animate-slide-in-right',
          // Mobile: bottom sheet
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl md:rounded-none animate-slide-up md:animate-none',
        ].join(' ')}
        style={{
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <div
          className="flex-shrink-0 px-4 pt-4 pb-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {/* Mobile drag handle */}
          <div className="flex justify-center mb-3 md:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
          </div>

          <div className="flex items-start gap-3">
            {/* Party name + type chip */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ background: sc.bg, color: sc.color }}
                >
                  {party.status}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  {type === 'debtor' ? 'Debtor' : 'Creditor'}
                </span>
              </div>
              <h2
                className="font-display font-semibold text-lg leading-snug"
                style={{ color: 'var(--text-primary)' }}
              >
                {party.party_name}
              </h2>
            </div>

            {/* Share + Pin + Close */}
            <div className="flex items-center gap-1 flex-shrink-0" ref={shareRef}>
              {/* Share button */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (!pdfLoading) {
                      setShareOpen(v => !v)
                      setWaMode(false)
                    }
                  }}
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

                {/* Share popover — desktop anchored below button, mobile bottom-sheet via fixed */}
                {shareOpen && !pdfLoading && (
                  <>
                    {/* Mobile: full bottom sheet backdrop */}
                    <div
                      className="fixed inset-0 z-[60] md:hidden"
                      style={{ background: 'var(--bg-overlay)' }}
                      onClick={() => { setShareOpen(false); setWaMode(false) }}
                    />

                    {/* Popover / sheet */}
                    <div
                      className={[
                        'z-[61] animate-fade-in',
                        // Desktop: absolute popover below button
                        'md:absolute md:right-0 md:top-full md:mt-2 md:w-64 md:rounded-xl md:shadow-lg',
                        // Mobile: fixed bottom sheet
                        'fixed bottom-0 inset-x-0 rounded-t-2xl md:rounded-xl',
                      ].join(' ')}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-lg)',
                      }}
                    >
                      {/* Mobile drag handle */}
                      <div className="flex justify-center pt-3 pb-1 md:hidden">
                        <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
                      </div>

                      <div className="p-2">
                        {/* ── WhatsApp number input mode (BUG-4) ── */}
                        {waMode ? (
                          <div className="px-3 py-2">
                            {/* Back link */}
                            <button
                              onClick={() => setWaMode(false)}
                              className="flex items-center gap-1.5 text-xs mb-3 transition-opacity hover:opacity-70"
                              style={{ color: 'var(--brand)' }}
                            >
                              <ArrowLeft size={12} />
                              Back
                            </button>

                            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                              Send via WhatsApp
                            </p>
                            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                              PDF will download to your device simultaneously.
                            </p>

                            {/* Number input row */}
                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className="flex-shrink-0 text-xs font-mono px-2 py-2 rounded-lg"
                                style={{
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                +91
                              </span>
                              <input
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                value={waNumber}
                                onChange={e => setWaNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="10-digit number"
                                className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                                style={{
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-primary)',
                                  minHeight: '44px',
                                }}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleWhatsAppSend() }}
                              />
                            </div>

                            <button
                              onClick={handleWhatsAppSend}
                              disabled={waLoading}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                              style={{
                                background: '#25d366',
                                color: '#fff',
                                opacity: waLoading ? 0.6 : 1,
                                minHeight: '44px',
                              }}
                            >
                              {waLoading
                                ? <Loader2 size={14} className="animate-spin" />
                                : <MessageCircle size={14} />
                              }
                              {waLoading ? 'Generating PDF…' : 'Open WhatsApp'}
                            </button>
                          </div>
                        ) : (
                          /* ── Normal share options ── */
                          <>
                            <p
                              className="text-xs font-semibold px-3 py-1.5 mb-1"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Export / Share
                            </p>

                            {/* Download PDF */}
                            <button
                              onClick={handleDownload}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
                              style={{ color: 'var(--text-primary)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'var(--brand-light)' }}>
                                <Download size={14} style={{ color: 'var(--brand)' }} />
                              </div>
                              <div>
                                <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Download PDF</div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Save to device</div>
                              </div>
                            </button>

                            {/* WhatsApp — BUG-4: opens number input instead of direct send */}
                            <button
                              onClick={handleWhatsAppClick}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
                              style={{ color: 'var(--text-primary)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: '#d4f0dd' }}>
                                <MessageCircle size={14} style={{ color: '#2e7d46' }} />
                              </div>
                              <div>
                                <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>WhatsApp</div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Send via WhatsApp</div>
                              </div>
                            </button>

                            {/* Email */}
                            <button
                              onClick={handleEmail}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
                              style={{ color: 'var(--text-primary)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'var(--error-light)' }}>
                                <Mail size={14} style={{ color: 'var(--error)' }} />
                              </div>
                              <div>
                                <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Email</div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Open mail client</div>
                              </div>
                            </button>

                            {/* Print */}
                            <button
                              onClick={handlePrint}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
                              style={{ color: 'var(--text-primary)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <Printer size={14} style={{ color: 'var(--text-muted)' }} />
                              </div>
                              <div>
                                <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Print</div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Print statement</div>
                              </div>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Mobile bottom padding for safe area */}
                      <div className="h-4 md:hidden" />
                    </div>
                  </>
                )}
              </div>

              {/* Pin button */}
              <button
                onClick={handlePin}
                disabled={pinLoading}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{
                  background: isPinned ? 'var(--brand-light)' : 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                }}
                aria-label={isPinned ? 'Unpin party' : 'Pin party'}
              >
                <Star
                  size={16}
                  fill={isPinned ? 'var(--brand)' : 'none'}
                  style={{ color: isPinned ? 'var(--brand)' : 'var(--text-muted)' }}
                />
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                aria-label="Close"
              >
                <X size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>

          {/* Closing balance + label pill */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span
              className="font-mono font-semibold text-2xl"
              style={{ color: bal < 0 ? 'var(--error)' : 'var(--text-primary)' }}
            >
              {balFormatted}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>closing balance</span>

            {/* Label pill — tapping opens label picker */}
            <div className="relative ml-auto">
              {(() => {
                const currentLabel = hooks.partyLabelKey ?? null
                const sys = SYSTEM_LABELS.find(l => l.key === currentLabel)
                const custom = customLabels.find(c => c.label_key === currentLabel)
                const display = sys ?? (custom ? { name: custom.label_name, colorHex: custom.color_hex } : null)
                return (
                  <button
                    onClick={() => setLabelOpen(v => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                    style={display ? {
                      background: display.colorHex + '22',
                      color: display.colorHex,
                      border: `1px solid ${display.colorHex}44`,
                    } : {
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                    aria-label="Set label for this party"
                    title="Set party label"
                  >
                    <Tag size={11} />
                    {display ? display.name : 'Label'}
                  </button>
                )
              })()}
              {labelOpen && (
                <FinLabelPicker
                  currentLabel={hooks.partyLabelKey ?? null}
                  customLabels={customLabels}
                  onSelect={handleLabelSelect}
                  onClose={() => setLabelOpen(false)}
                  onManage={() => { setLabelOpen(false); setManagerOpen(true) }}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Tab strip ────────────────────────────────────── */}
        <div
          className="flex flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
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
                  marginBottom: '-1px',
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            )
          })}
        </div>

        {/* ── Tab content ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'ledger' && (
            <FinLedgerTab
              party={party}
              partyType={type}
              fetchLedger={hooks.fetchLedger}
              onLedgerLoaded={setCachedLedger}
            />
          )}
          {activeTab === 'outstanding' && (
            <FinOutstandingTab
              party={party}
              partyType={type}
              fetchOutstanding={hooks.fetchOutstanding}
              onOutstandingLoaded={setCachedOutstanding}
            />
          )}
          {activeTab === 'contact' && (
            <FinContactTab
              party={party}
              partyType={type}
              fetchContact={hooks.fetchContact}
              fetchNotes={hooks.fetchNotes}
              addNote={hooks.addNote}
              deleteNote={hooks.deleteNote}
            />
          )}
          {activeTab === 'insights' && (
            <FinInsightsTab
              party={party}
              partyType={type}
              ledgerRows={cachedLedger}
              outstandingRows={cachedOutstanding}
              fetchLedger={hooks.fetchLedger}
              fetchOutstanding={hooks.fetchOutstanding}
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
    </>
  )
}
