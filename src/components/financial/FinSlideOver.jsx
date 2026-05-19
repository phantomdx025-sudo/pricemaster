/**
 * FinSlideOver — Slide-in panel showing party details.
 * Phase FIN-2: Core slide-over with Ledger / Outstanding / Contact tabs.
 * Phase FIN-3: Share button + share sheet (Download, WhatsApp, Email, Print).
 *
 * Props:
 *   party       — fin_parties row (or null when closed)
 *   partyType   — 'debtor' | 'creditor'
 *   onClose     — fn()
 *   pinned      — Set<'type:name'>
 *   hooks       — { fetchLedger, fetchOutstanding, fetchContact, fetchNotes, addNote, deleteNote, togglePin }
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Star, BookOpen, AlertCircle, Phone, Share2, Download, MessageCircle, Mail, Printer, Loader2 } from 'lucide-react'
import FinLedgerTab      from './FinLedgerTab'
import FinOutstandingTab from './FinOutstandingTab'
import FinContactTab     from './FinContactTab'
import { generatePartyPDF } from './FinPdfExport'
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
]

export default function FinSlideOver({ party, partyType, onClose, pinned, hooks }) {
  const [activeTab,    setActiveTab]    = useState('ledger')
  const [pinLoading,   setPinLoading]   = useState(false)
  const [shareOpen,    setShareOpen]    = useState(false)
  const [pdfLoading,   setPdfLoading]   = useState(false)
  const shareRef = useRef(null)

  // Close share sheet when clicking outside
  useEffect(() => {
    if (!shareOpen) return
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShareOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [shareOpen])

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
      const blob = await generatePartyPDF(party, ledger, outstanding, contact)
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

  const handleWhatsApp = useCallback(async () => {
    setShareOpen(false)
    // Fetch contact for mobile number
    let mobile = null
    try {
      const contact = await hooks.fetchContact(party?.party_name ?? '')
      mobile = contact?.mobile?.replace(/\D/g, '') ?? null
    } catch (_) {}

    if (!mobile) {
      toast.error('No mobile number on file for this party')
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

    const msg = encodeURIComponent(
      `Dear ${party?.party_name ?? 'Sir/Madam'},\n\nPlease find your account statement attached.\n\nThank you.`
    )
    window.open(`https://wa.me/91${mobile}?text=${msg}`, '_blank', 'noopener')
  }, [buildPDF, party, hooks])

  const handleEmail = useCallback(async () => {
    setShareOpen(false)
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

      {/* Panel — right on desktop, bottom on mobile */}
      <div
        className={[
          'fixed z-50 flex flex-col',
          // Desktop: right panel
          'md:inset-y-0 md:right-0 md:w-[480px] md:animate-slide-in-right',
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
                  onClick={() => !pdfLoading && setShareOpen(v => !v)}
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
                      onClick={() => setShareOpen(false)}
                    />

                    {/* Popover / sheet */}
                    <div
                      className={[
                        'z-[61] animate-fade-in',
                        // Desktop: absolute popover below button
                        'md:absolute md:right-0 md:top-full md:mt-2 md:w-52 md:rounded-xl md:shadow-lg',
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

                        {/* WhatsApp */}
                        <button
                          onClick={handleWhatsApp}
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

          {/* Closing balance sub-header */}
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className="font-mono font-semibold text-2xl"
              style={{ color: bal < 0 ? 'var(--error)' : 'var(--text-primary)' }}
            >
              {balFormatted}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>closing balance</span>
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
            />
          )}
          {activeTab === 'outstanding' && (
            <FinOutstandingTab
              party={party}
              partyType={type}
              fetchOutstanding={hooks.fetchOutstanding}
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
        </div>
      </div>
    </>
  )
}
