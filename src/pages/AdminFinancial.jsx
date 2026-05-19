/**
 * AdminFinancial — Financial Reports page.
 * Phase FIN-1: Dashboard cards + Debtors/Creditors tabbed party list.
 * Phase FIN-2: FinSearch + FinSlideOver with Ledger/Outstanding/Contact tabs.
 */
import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { useFinancial } from '../hooks/useFinancial'
import FinDashboardCards from '../components/financial/FinDashboardCards'
import FinPartyList      from '../components/financial/FinPartyList'
import FinSearch         from '../components/financial/FinSearch'
import FinSlideOver      from '../components/financial/FinSlideOver'

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
        Open the PriceMaster Sync Tool, go to the Financial tab, select your Tally Excel exports, and click Sync All to load data here.
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
  const fin = useFinancial()
  const {
    debtors, creditors, addressMap, syncLog, pinned,
    loading, error, loadAll, clearCache,
    fetchLedger, fetchOutstanding, fetchContact, fetchNotes,
    addNote, deleteNote, togglePin,
  } = fin

  const [activeTab,      setActiveTab]      = useState('debtors')
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [selectedParty,  setSelectedParty]  = useState(null)
  const [slideOverOpen,  setSlideOverOpen]  = useState(false)

  useEffect(() => { loadAll() }, [loadAll])

  const handleRetry = () => {
    clearCache()
    loadAll()
  }

  const handlePartyClick = useCallback((party) => {
    setSelectedParty(party)
    setSlideOverOpen(true)
    setSearchOpen(false)
  }, [])

  const handleSlideOverClose = useCallback(() => {
    setSlideOverOpen(false)
    // Keep selectedParty so the slide-over animates out gracefully — clear after a beat
    setTimeout(() => setSelectedParty(null), 350)
  }, [])

  const hasData = debtors.length > 0 || creditors.length > 0

  const tabs = [
    { id: 'debtors',   label: 'Debtors',   count: debtors.length   },
    { id: 'creditors', label: 'Creditors', count: creditors.length },
  ]

  const slideOverHooks = {
    fetchLedger, fetchOutstanding, fetchContact,
    fetchNotes, addNote, deleteNote, togglePin,
  }

  const bulkExportHooks = { fetchLedger, fetchOutstanding, fetchContact }

  return (
    <div
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
            {/* Search button */}
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
            {/* Refresh button */}
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

        {/* ── Dashboard cards ────────────────────────────────── */}
        <FinDashboardCards
          debtors={debtors}
          creditors={creditors}
          syncLog={syncLog}
          loading={loading && !hasData}
        />

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
                    onClick={() => setActiveTab(tab.id)}
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

      {/* ── Slide-over ────────────────────────────────────── */}
      {slideOverOpen && selectedParty && (
        <FinSlideOver
          party={selectedParty}
          partyType={selectedParty.party_type}
          onClose={handleSlideOverClose}
          pinned={pinned}
          hooks={slideOverHooks}
        />
      )}
    </div>
  )
}
