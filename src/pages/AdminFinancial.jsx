/**
 * AdminFinancial — Financial party list page.
 * Phase FIN-1: Dashboard cards + Debtors/Creditors tabbed party list.
 * Phase FIN-2: FinSearch + FinSlideOver with Ledger/Outstanding/Contact tabs.
 * Phase AX-3: onPartyClick now navigates to /admin/financial/ledger/:partyType/:partyName
 *   instead of opening FinSlideOver. FinSlideOver.jsx is kept but not used here.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { TrendingUp, AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { useFinancial } from '../hooks/useFinancial'
import FinPartyList      from '../components/financial/FinPartyList'
import FinSearch         from '../components/financial/FinSearch'

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--brand-light)' }}
      >
        <TrendingUp size={24} style={{ color: 'var(--brand)' }} />
      </div>
      <h3 className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
        No financial data synced yet
      </h3>
      <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
        Open the ANKxIOUS Sync Tool, go to the Financial tab, select your Tally Excel exports, and click Sync All to load data here.
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--error-light)' }}
      >
        <AlertTriangle size={20} style={{ color: 'var(--error)' }} />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--error)' }}>Failed to load financial data</p>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{message}</p>
      <button onClick={onRetry} className="btn-ghost text-xs flex items-center gap-1.5">
        <RefreshCw size={12} />
        Retry
      </button>
    </div>
  )
}

export default function AdminFinancialContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const fin = useFinancial()
  const {
    debtors, creditors, addressMap, syncLog, pinned,
    loading, error, loadAll, clearCache,
    fetchLedger, fetchOutstanding, fetchContact,
    fetchAllPartyLabels, setPartyLabel, fetchCustomLabels, addCustomLabel, deleteCustomLabel,
  } = fin

  // BX-3: Persist active tab via sessionStorage
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('fin_tab') ?? 'debtors'
  )

  function handleSetActiveTab(val) {
    setActiveTab(val)
    sessionStorage.setItem('fin_tab', val)
  }

  // BX-3: Scroll persistence
  const containerRef = useRef(null)
  const scrollRestored = useRef(false)

  // Save scroll position on unmount; also reset scrollRestored so it works
  // correctly if the user navigates away and comes back.
  useEffect(() => {
    scrollRestored.current = false
    return () => {
      if (containerRef.current) {
        sessionStorage.setItem('fin_scroll', String(containerRef.current.scrollTop))
      }
      scrollRestored.current = false
    }
  }, [])

  // Restore scroll only after the list has content AND this component's container
  // is actually in the DOM. The containerRef guard prevents this from firing on
  // other pages (e.g. Catalogue) that happen to share the same hook state.
  useEffect(() => {
    if (scrollRestored.current) return
    if (!containerRef.current) return   // not our page — bail
    const saved = sessionStorage.getItem('fin_scroll')
    if (!saved) return
    const parties = activeTab === 'debtors' ? debtors : creditors
    if (parties.length === 0) return    // wait until list has content
    scrollRestored.current = true
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = parseInt(saved, 10)
      }
    })
  }, [debtors, creditors, activeTab])
  const [debtorLabelMap,  setDebtorLabelMap]  = useState(new Map())
  const [creditorLabelMap,setCreditorLabelMap]= useState(new Map())
  const [searchOpen,      setSearchOpen]      = useState(false)

  useEffect(() => { loadAll() }, [loadAll])

  // Fetch all party labels for debtors + creditors in parallel
  useEffect(() => {
    if (!fetchAllPartyLabels) return
    fetchAllPartyLabels('debtor')
      .then(setDebtorLabelMap)
      .catch(err => { if (import.meta.env.DEV) console.warn('fetchAllPartyLabels debtor:', err.message) })
    fetchAllPartyLabels('creditor')
      .then(setCreditorLabelMap)
      .catch(err => { if (import.meta.env.DEV) console.warn('fetchAllPartyLabels creditor:', err.message) })
  }, [fetchAllPartyLabels])

  const handleRetry = () => {
    clearCache()
    loadAll()
  }

  // AX-3: Navigate to full-page ledger instead of opening slide-over
  const handlePartyClick = useCallback((party) => {
    setSearchOpen(false)
    const type = party.party_type
    const name = encodeURIComponent(party.party_name)
    navigate(`/admin/financial/ledger/${type}/${name}`, { state: { from: location.pathname } })
  }, [navigate])

  // Keeps label maps in sync when labels are changed from the party list
  const handleLabelChange = useCallback((partyType, partyName, labelKey) => {
    const setter = partyType === 'debtor' ? setDebtorLabelMap : setCreditorLabelMap
    setter(prev => {
      const next = new Map(prev)
      if (!labelKey || labelKey === 'not_reviewed') {
        next.delete(partyName)
      } else {
        next.set(partyName, labelKey)
      }
      return next
    })
  }, [])

  const hasData = debtors.length > 0 || creditors.length > 0

  const tabs = [
    { id: 'debtors',   label: 'Debtors',   count: debtors.length   },
    { id: 'creditors', label: 'Creditors', count: creditors.length },
  ]

  const bulkExportHooks = { fetchLedger, fetchOutstanding, fetchContact }

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-h-0 overflow-y-auto animate-fade-in"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="max-w-5xl mx-auto w-full px-4 py-5 flex flex-col gap-5">

        {/* ── Page header ───────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1
              className="font-display font-semibold text-xl leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Financial Reports
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Sundry Debtors &amp; Creditors — synced from Tally
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasData && (
              <button
                onClick={() => setSearchOpen(true)}
                className="btn-ghost text-xs flex items-center gap-1.5"
                style={{ padding: '6px 12px' }}
                aria-label="Search parties"
              >
                <Search size={14} />
                <span className="hidden sm:inline">Search</span>
              </button>
            )}
            <button
              onClick={handleRetry}
              disabled={loading}
              className="btn-ghost text-xs flex items-center gap-1.5"
              style={{ padding: '6px 12px' }}
              aria-label="Refresh data"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Error state ─────────────────────────────────────── */}
        {error && !loading && (
          <ErrorState message={error} onRetry={handleRetry} />
        )}

        {/* ── Empty state (no data, no error) ─────────────────── */}
        {!loading && !error && !hasData && (
          <EmptyState />
        )}

        {/* ── Tabs + Party list ────────────────────────────────── */}
        {(hasData || loading) && !error && (
          <div>
            {/* Tab strip */}
            <div
              className="flex gap-0 mb-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {tabs.map(tab => {
                const isActive = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSetActiveTab(tab.id)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors"
                    style={{
                      color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                      borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                      marginBottom: '-1px',
                    }}
                  >
                    {tab.label}
                    {!loading && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                        style={{
                          background: isActive ? 'var(--brand-light)' : 'var(--bg-elevated)',
                          color:      isActive ? 'var(--brand)'       : 'var(--text-muted)',
                        }}
                      >
                        {tab.count.toLocaleString('en-IN')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Party list */}
            {activeTab === 'debtors' && (
              <FinPartyList
                parties={debtors}
                addressMap={addressMap}
                pinned={pinned}
                loading={loading && debtors.length === 0}
                partyType="debtor"
                onPartyClick={handlePartyClick}
                bulkExportHooks={bulkExportHooks}
                hooks={{ fetchAllPartyLabels, setPartyLabel, fetchCustomLabels, addCustomLabel, deleteCustomLabel }}
                labelMap={debtorLabelMap}
                onLabelChange={handleLabelChange}
              />
            )}
            {activeTab === 'creditors' && (
              <FinPartyList
                parties={creditors}
                addressMap={addressMap}
                pinned={pinned}
                loading={loading && creditors.length === 0}
                partyType="creditor"
                onPartyClick={handlePartyClick}
                bulkExportHooks={bulkExportHooks}
                hooks={{ fetchAllPartyLabels, setPartyLabel, fetchCustomLabels, addCustomLabel, deleteCustomLabel }}
                labelMap={creditorLabelMap}
                onLabelChange={handleLabelChange}
              />
            )}
          </div>
        )}

      </div>

      {/* ── Search overlay ────────────────────────────────── */}
      <FinSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        debtors={debtors}
        creditors={creditors}
        addressMap={addressMap}
        onSelect={handlePartyClick}
      />
    </div>
  )
}