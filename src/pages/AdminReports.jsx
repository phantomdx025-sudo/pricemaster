/**
 * AdminReports — Dedicated Reports page.
 *
 * Phase B6-1 changes:
 *   BX-1 — "All Time" preset (no date filter, all 3 tabs)
 *   BX-2 — Party names tappable in PeriodBreakdownTab → navigate to ledger
 *   BX-4 — "Sales Overview" full-width featured card on Overview tab
 *   BX-9 — FinDashboardCards moved here from AdminFinancial
 *
 * Phase B6-3 changes:
 *   BX-10A — Top 10 Debtors by Outstanding list with mini bars (Overview tab)
 *   BX-10B — Collection Efficiency % card with progress bar (Overview tab)
 *   BX-10C — Net Position card (Overview tab)
 *   BX-10D — Most Active Month callout (Period Breakdown tab)
 *   BX-10E — Export CSV button (Period Breakdown tab)
 *
 * Tabs: Overview / Period Breakdown / Payment Periods
 * Period selector at top with quick presets incl. All Time.
 * All amounts use full Indian formatting: ₹48,24,310.50
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart2, TrendingUp, ArrowDownCircle, ShoppingBag,
  Package, ArrowUpCircle, AlertCircle, AlertTriangle,
  Users, Building2, RefreshCw, ChevronDown, ChevronUp,
  Download, Scale, Zap,
} from 'lucide-react'
import { useFinancialReports } from '../hooks/useFinancialReports'
import { useFinancial } from '../hooks/useFinancial'
import Spinner from '../components/ui/Spinner'
import FinPaymentPeriodsTab from '../components/financial/FinPaymentPeriodsTab'
import FinDashboardCards from '../components/financial/FinDashboardCards'

// ── Formatting ──────────────────────────────────────────────────────────────

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function fmtDate(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d)) return isoStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function toInputDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Indian FY helpers ────────────────────────────────────────────────────────

function fyStart(year) { return new Date(year, 3, 1) }
function fyEnd(year)   { return new Date(year + 1, 2, 31) }
function currentFYYear() {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

function getPresetRange(preset) {
  if (preset === 'all_time') return null // signal: no date filter

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y = today.getFullYear()
  const m = today.getMonth()

  if (preset === 'this_month') {
    return { from: toInputDate(new Date(y, m, 1)), to: toInputDate(today) }
  }
  if (preset === 'last_month') {
    return { from: toInputDate(new Date(y, m - 1, 1)), to: toInputDate(new Date(y, m, 0)) }
  }
  if (preset === 'this_fy') {
    const fyY = currentFYYear()
    return { from: toInputDate(fyStart(fyY)), to: toInputDate(today) }
  }
  if (preset === 'last_fy') {
    const fyY = currentFYYear() - 1
    return { from: toInputDate(fyStart(fyY)), to: toInputDate(fyEnd(fyY)) }
  }
  return null // custom
}

// ── Period Selector ──────────────────────────────────────────────────────────

// BX-1: "All Time" added before "Custom"
const PRESETS = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_fy',   label: 'This FY'    },
  { id: 'last_fy',   label: 'Last FY'    },
  { id: 'all_time',  label: 'All Time'   },
  { id: 'custom',    label: 'Custom'     },
]

function PeriodSelector({ from, to, preset, onFromChange, onToChange, onPresetChange, isAllTime, isLandscape = false }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className={['flex gap-3', isLandscape ? 'flex-row items-center' : 'flex-col'].join(' ')}>
        {/* Preset pills */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {PRESETS.map(p => {
            const active = preset === p.id
            return (
              <button
                key={p.id}
                onClick={() => onPresetChange(p.id)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: active ? 'var(--brand)' : 'var(--bg-surface)',
                  color:      active ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  border:     active ? '1px solid var(--brand)' : '1px solid var(--border)',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* BX-1: Hide date inputs when All Time is active */}
        {!isAllTime && (
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>From</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={e => onFromChange(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm outline-none w-full"
                style={{
                  background: 'var(--bg-surface)',
                  border:     '1px solid var(--border)',
                  color:      'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>To</label>
              <input
                type="date"
                value={to}
                min={from}
                max={toInputDate(new Date())}
                onChange={e => onToChange(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm outline-none w-full"
                style={{
                  background: 'var(--bg-surface)',
                  border:     '1px solid var(--border)',
                  color:      'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* BX-1: All Time badge */}
      {isAllTime && (
        <div
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}
        >
          Showing all data — no date filter applied
        </div>
      )}
    </div>
  )
}

// ── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, iconColor, iconBg, label, value, sub }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg ?? 'var(--brand-light)' }}
        >
          <Icon size={15} style={{ color: iconColor ?? 'var(--brand)' }} />
        </div>
        <span className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
      <div>
        <p
          className="text-sm font-semibold leading-snug break-all"
          style={{ color: 'var(--text-primary)' }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Monthly Bar Chart ────────────────────────────────────────────────────────

function MonthlyBarChart({ rows, partyType }) {
  const monthMap = useMemo(() => {
    const map = new Map()
    rows.forEach(r => {
      const key = r.txn_date?.slice(0, 7)
      if (!key) return
      const prev = map.get(key) ?? { debit: 0, credit: 0 }
      map.set(key, {
        debit:  prev.debit  + (parseFloat(r.debit)  || 0),
        credit: prev.credit + (parseFloat(r.credit) || 0),
      })
    })
    return new Map([...map.entries()].sort())
  }, [rows])

  const entries = [...monthMap.entries()]

  if (entries.length === 0) {
    return (
      <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
        No data for chart
      </p>
    )
  }

  const BAR_W = 22
  const GAP   = 4
  const PAIR_GAP = 10
  const H     = 72
  const allValues = entries.flatMap(([, v]) => [v.debit, v.credit])
  const maxVal = Math.max(...allValues, 1)
  const pairW  = BAR_W * 2 + GAP + PAIR_GAP
  const totalW = entries.length * pairW - PAIR_GAP

  function barH(val) {
    return maxVal > 0 ? Math.max(4, Math.round((val / maxVal) * H)) : 4
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${Math.max(totalW, 100)} ${H + 36}`}
        width="100%"
        style={{ minWidth: Math.min(totalW, 340), overflow: 'visible' }}
        aria-label={`Monthly debit/credit chart for ${partyType}s`}
      >
        {entries.map(([month, vals], i) => {
          const x = i * pairW
          const dH = barH(vals.debit)
          const cH = barH(vals.credit)
          const monthLabel = new Date(month + '-01').toLocaleString('en-IN', { month: 'short' })

          return (
            <g key={month}>
              <rect x={x} y={H - dH} width={BAR_W} height={dH} rx={3}
                fill="var(--brand)" opacity={vals.debit === 0 ? 0.2 : 0.85} />
              <rect x={x + BAR_W + GAP} y={H - cH} width={BAR_W} height={cH} rx={3}
                fill="var(--success)" opacity={vals.credit === 0 ? 0.2 : 0.85} />
              <text x={x + BAR_W + GAP / 2} y={H + 14} textAnchor="middle"
                fontSize={9} fill="var(--text-muted)">{monthLabel}</text>
            </g>
          )
        })}
      </svg>

      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--brand)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Debit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--success)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Credit</span>
        </div>
      </div>
    </div>
  )
}

// ── Compute period metrics ───────────────────────────────────────────────────

function computeMetrics(debtorRows, creditorRows, outstanding) {
  let totalTurnover    = 0
  let receivableCollected = 0
  let totalSales       = 0
  const debtorParties  = new Set()

  debtorRows.forEach(r => {
    const debit  = parseFloat(r.debit)  || 0
    const credit = parseFloat(r.credit) || 0
    totalTurnover       += debit
    receivableCollected += credit
    if ((r.vch_type ?? '').toLowerCase().includes('sales')) totalSales += debit
    debtorParties.add(r.party_name)
  })

  let totalPurchases   = 0
  let paidToCreditors  = 0
  const creditorParties = new Set()

  creditorRows.forEach(r => {
    const debit  = parseFloat(r.debit)  || 0
    const credit = parseFloat(r.credit) || 0
    totalPurchases  += debit
    paidToCreditors += credit
    creditorParties.add(r.party_name)
  })

  return {
    totalTurnover,
    receivableCollected,
    totalSales,
    totalPurchases,
    paidToCreditors,
    debtorOutstanding:  outstanding.debtorTotal,
    creditorPayable:    outstanding.creditorTotal,
    activeDebtors:      debtorParties.size,
    activeCreditors:    creditorParties.size,
  }
}

// ── BX-10A: Top Debtors List with mini bars ──────────────────────────────────

function TopDebtorsList({ debtorOutstandingList, navigate }) {
  const [expanded, setExpanded] = useState(false)

  const top10 = useMemo(() => {
    return [...debtorOutstandingList]
      .filter(p => p.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10)
  }, [debtorOutstandingList])

  if (top10.length === 0) return null

  const maxOutstanding = top10[0]?.outstanding ?? 1

  return (
    <div
      className="rounded-xl"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ borderBottom: expanded ? '1px solid var(--border)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={15} style={{ color: 'var(--error)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Top 10 Debtors by Outstanding
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {top10.length} shown
          </span>
          {expanded
            ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          }
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-0 px-4 py-3">
          {top10.map((party, idx) => {
            const pct = maxOutstanding > 0 ? (party.outstanding / maxOutstanding) * 100 : 0
            return (
              <div key={party.party_name} className="py-2" style={{ borderBottom: idx < top10.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 16 }}>
                      {idx + 1}.
                    </span>
                    <button
                      onClick={() => navigate(`/admin/financial/ledger/debtor/${encodeURIComponent(party.party_name)}`)}
                      className="text-xs font-medium truncate text-left hover:underline"
                      style={{ color: 'var(--brand)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      {party.party_name}
                    </button>
                  </div>
                  <span className="text-xs font-semibold flex-shrink-0 font-mono" style={{ color: 'var(--error)' }}>
                    {fmt(party.outstanding)}
                  </span>
                </div>
                <div className="h-1 rounded-full ml-5" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-1 rounded-full"
                    style={{ width: `${pct}%`, background: 'var(--error)', transition: 'width 0.4s ease' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── BX-10B: Collection Efficiency Card ───────────────────────────────────────

function CollectionEfficiencyCard({ receivableCollected, totalTurnover }) {
  const efficiency = totalTurnover > 0
    ? Math.min(100, Math.round((receivableCollected / totalTurnover) * 100))
    : 0

  const effColor = efficiency > 75 ? 'var(--success)' : efficiency > 50 ? 'var(--warning)' : 'var(--error)'

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap size={14} style={{ color: effColor }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Collection Efficiency</p>
      </div>
      <p className="text-2xl font-bold mt-1 font-mono" style={{ color: effColor }}>
        {efficiency}%
      </p>
      <div className="h-1.5 rounded-full mt-2" style={{ background: 'var(--border)' }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${efficiency}%`, background: effColor }}
        />
      </div>
      <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
        {fmt(receivableCollected)} collected of {fmt(totalTurnover)} billed
      </p>
    </div>
  )
}

// ── BX-10C: Net Position Card ─────────────────────────────────────────────────

function NetPositionCard({ debtorOutstanding, creditorPayable }) {
  const netPosition  = debtorOutstanding - creditorPayable
  const isPositive   = netPosition >= 0

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Scale size={14} style={{ color: isPositive ? 'var(--success)' : 'var(--warning)' }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Net Position</p>
      </div>
      <p
        className="text-lg font-bold font-mono leading-tight"
        style={{ color: isPositive ? 'var(--success)' : 'var(--warning)' }}
      >
        {isPositive ? '+' : '−'}{fmt(Math.abs(netPosition))}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        {isPositive ? 'Net receivable' : 'Net payable'} · Debtors {fmt(debtorOutstanding)} vs Creditors {fmt(creditorPayable)}
      </p>
    </div>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ debtorRows, creditorRows, outstanding, debtorOutstandingList, loading, isLandscape = false }) {
  const [chartType, setChartType] = useState('debtors')

  const metrics = useMemo(
    () => computeMetrics(debtorRows, creditorRows, outstanding),
    [debtorRows, creditorRows, outstanding]
  )

  const navigate  = useNavigate()
  const chartRows = chartType === 'debtors' ? debtorRows : creditorRows

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {/* BX-4: skeleton for featured card */}
        <div className="rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)', minHeight: '76px' }} />
        <div className={['grid gap-3', isLandscape ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3'].join(' ')}>
          {[...Array(9)].map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse"
              style={{ background: 'var(--bg-elevated)', minHeight: '90px' }} />
          ))}
        </div>
      </div>
    )
  }

  const CARDS = [
    {
      icon: TrendingUp,
      label: 'Total Turnover (Debtors Dr)',
      value: fmt(metrics.totalTurnover),
      iconBg: 'var(--brand-light)',
      iconColor: 'var(--brand)',
    },
    {
      icon: ArrowDownCircle,
      label: 'Receivable Collected (Debtors Cr)',
      value: fmt(metrics.receivableCollected),
      iconBg: 'var(--success-light)',
      iconColor: 'var(--success)',
    },
    {
      icon: ShoppingBag,
      label: 'Total Sales (Sales entries)',
      value: fmt(metrics.totalSales),
      iconBg: 'var(--brand-light)',
      iconColor: 'var(--brand)',
    },
    {
      icon: Package,
      label: 'Total Purchases (Creditors Dr)',
      value: fmt(metrics.totalPurchases),
      iconBg: 'var(--warning-light)',
      iconColor: 'var(--warning)',
    },
    {
      icon: ArrowUpCircle,
      label: 'Paid to Creditors (Creditors Cr)',
      value: fmt(metrics.paidToCreditors),
      iconBg: 'var(--success-light)',
      iconColor: 'var(--success)',
    },
    {
      icon: AlertCircle,
      label: 'Currently Outstanding (Debtors)',
      value: fmt(metrics.debtorOutstanding),
      sub: 'Current snapshot — not period-filtered',
      iconBg: 'var(--error-light)',
      iconColor: 'var(--error)',
    },
    {
      icon: AlertTriangle,
      label: 'Currently Payable (Creditors)',
      value: fmt(metrics.creditorPayable),
      sub: 'Current snapshot — not period-filtered',
      iconBg: 'var(--warning-light)',
      iconColor: 'var(--warning)',
    },
    {
      icon: Users,
      label: 'Active Debtors in Period',
      value: metrics.activeDebtors.toLocaleString('en-IN'),
      iconBg: 'var(--brand-light)',
      iconColor: 'var(--brand)',
    },
    {
      icon: Building2,
      label: 'Active Creditors in Period',
      value: metrics.activeCreditors.toLocaleString('en-IN'),
      iconBg: 'var(--bg-elevated)',
      iconColor: 'var(--text-secondary)',
    },
  ]

  return (
    <div className="flex flex-col gap-5">

      {/* BX-4: Sales Overview — full-width featured card */}
      <div
        className="rounded-xl p-4 flex items-center gap-4"
        style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-border)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--brand)' }}
        >
          <ShoppingBag size={18} style={{ color: 'var(--text-inverse)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>Sales Overview</p>
          <p className="text-lg font-bold font-mono leading-tight" style={{ color: 'var(--text-primary)' }}>
            {fmt(metrics.totalTurnover)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total debit side of debtors · {metrics.activeDebtors.toLocaleString('en-IN')} active parties
          </p>
        </div>
      </div>

      {/* Metric cards grid */}
      <div className={['grid gap-3', isLandscape ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3'].join(' ')}>
        {CARDS.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      {/* Monthly bar chart */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Monthly Debit / Credit — {chartType === 'debtors' ? 'Debtors' : 'Creditors'}
          </p>
          <div className="flex gap-1">
            {['debtors', 'creditors'].map(t => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: chartType === t ? 'var(--brand)' : 'var(--bg-surface)',
                  color:      chartType === t ? 'var(--text-inverse)' : 'var(--text-muted)',
                  border:     chartType === t ? '1px solid var(--brand)' : '1px solid var(--border)',
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <MonthlyBarChart rows={chartRows} partyType={chartType} />
      </div>

      {/* BX-10B + BX-10C: Collection Efficiency + Net Position row */}
      <div className={['grid gap-3', isLandscape ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'].join(' ')}>
        <CollectionEfficiencyCard
          receivableCollected={metrics.receivableCollected}
          totalTurnover={metrics.totalTurnover}
        />
        <NetPositionCard
          debtorOutstanding={metrics.debtorOutstanding}
          creditorPayable={metrics.creditorPayable}
        />
      </div>

      {/* BX-10A: Top 10 Debtors by Outstanding — expandable */}
      <TopDebtorsList debtorOutstandingList={debtorOutstandingList} navigate={navigate} />
    </div>
  )
}

// ── Period Breakdown Tab ─────────────────────────────────────────────────────

function buildPartyBreakdown(rows) {
  const map = new Map()

  rows.forEach(r => {
    const name = r.party_name
    if (!map.has(name)) {
      map.set(name, {
        party_name:    name,
        firstBalance:  null,
        lastBalance:   null,
        totalDebit:    0,
        totalCredit:   0,
        txnCount:      0,
        firstTxnDate:  r.txn_date,
        lastTxnDate:   r.txn_date,
      })
    }
    const entry = map.get(name)
    const debit   = parseFloat(r.debit)   || 0
    const credit  = parseFloat(r.credit)  || 0
    const balance = parseFloat(r.balance)

    if (entry.firstBalance === null) entry.firstBalance = balance
    entry.lastBalance  = isNaN(balance) ? entry.lastBalance : balance
    entry.totalDebit  += debit
    entry.totalCredit += credit
    entry.txnCount    += 1
    if (r.txn_date > entry.lastTxnDate)  entry.lastTxnDate  = r.txn_date
    if (r.txn_date < entry.firstTxnDate) entry.firstTxnDate = r.txn_date
  })

  return [...map.values()]
}

function filterParties(list, query) {
  if (!query.trim()) return list
  const q = query.toLowerCase()
  return list.filter(p => p.party_name.toLowerCase().includes(q))
}

// ── BX-10E: CSV Export helper ─────────────────────────────────────────────────

function exportCSV(data, filename) {
  const headers = ['Party Name', 'Total Debited', 'Total Credited', 'Closing Balance', 'Txns']
  const rows = data.map(p => [
    `"${(p.party_name ?? '').replace(/"/g, '""')}"`,
    p.totalDebit.toFixed(2),
    p.totalCredit.toFixed(2),
    (p.lastBalance ?? 0).toFixed(2),
    p.txnCount,
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── BX-10D: Most Active Month helper ─────────────────────────────────────────

function getMostActiveMonth(rows) {
  const monthCount = new Map()
  rows.forEach(r => {
    const key = r.txn_date?.slice(0, 7)
    if (!key) return
    monthCount.set(key, (monthCount.get(key) ?? 0) + 1)
  })
  if (monthCount.size === 0) return null
  let best = null
  let bestCount = 0
  monthCount.forEach((count, month) => {
    if (count > bestCount) { bestCount = count; best = month }
  })
  if (!best) return null
  const label = new Date(best + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  return { month: best, label, count: bestCount }
}

// BX-2: PeriodBreakdownTab now uses navigate to open party ledger
// BX-10D: Most Active Month callout
// BX-10E: Export CSV button
function PeriodBreakdownTab({ debtorRows, creditorRows, loading }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('debtors')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('party_name')
  const [sortDir, setSortDir] = useState(1)
  const [showCount, setShowCount] = useState(50)

  const rawRows  = tab === 'debtors' ? debtorRows : creditorRows
  const breakdown = useMemo(() => buildPartyBreakdown(rawRows), [rawRows])
  const filtered  = useMemo(() => filterParties(breakdown, query), [breakdown, query])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return -1 * sortDir
      if (av > bv) return  1 * sortDir
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const visible = sorted.slice(0, showCount)

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(1) }
  }

  // BX-2: Navigate to ledger for party
  function goToLedger(partyName) {
    const partyType = tab === 'debtors' ? 'debtor' : 'creditor'
    navigate(`/admin/financial/ledger/${partyType}/${encodeURIComponent(partyName)}`)
  }

  // BX-10D: Most active month from the raw rows of the current tab
  const mostActiveMonth = useMemo(() => getMostActiveMonth(rawRows), [rawRows])

  // BX-10E: Export CSV for current visible breakdown (all sorted, not just visible slice)
  function handleExportCSV() {
    const filename = `${tab}_breakdown.csv`
    exportCSV(sorted, filename)
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return null
    return sortDir === 1
      ? <ChevronUp size={10} style={{ display: 'inline', marginLeft: 2 }} />
      : <ChevronDown size={10} style={{ display: 'inline', marginLeft: 2 }} />
  }

  const thStyle = {
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontSize: '11px',
    fontWeight: 600,
    padding: '8px 12px',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
  }
  const thLeftStyle = { ...thStyle, textAlign: 'left' }
  const tdStyle = {
    padding: '9px 12px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  }
  const tdLeftStyle = { ...tdStyle, textAlign: 'left' }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Debtors / Creditors toggle */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-1">
          {['debtors', 'creditors'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setShowCount(50) }}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: tab === t ? 'var(--brand)' : 'var(--bg-elevated)',
                color:      tab === t ? 'var(--text-inverse)' : 'var(--text-muted)',
                border:     tab === t ? '1px solid var(--brand)' : '1px solid var(--border)',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}{' '}
              <span style={{ opacity: 0.75 }}>
                ({tab === t ? filtered.length : (t === 'debtors' ? buildPartyBreakdown(debtorRows).length : buildPartyBreakdown(creditorRows).length)})
              </span>
            </button>
          ))}
        </div>

        {/* BX-10E: Export CSV + search row */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search party name…"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowCount(50) }}
            className="rounded-lg px-3 py-1.5 text-xs outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border:     '1px solid var(--border)',
              color:      'var(--text-primary)',
              minWidth:   '160px',
            }}
          />
          {sorted.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                border:     '1px solid var(--border)',
                color:      'var(--text-secondary)',
              }}
              title="Export visible data as CSV"
            >
              <Download size={12} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          No {tab} with ledger activity in this period.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thLeftStyle} onClick={() => handleSort('party_name')}>
                    Party Name <SortIcon col="party_name" />
                  </th>
                  <th style={thStyle} onClick={() => handleSort('totalDebit')}>
                    Total Debited <SortIcon col="totalDebit" />
                  </th>
                  <th style={thStyle} onClick={() => handleSort('totalCredit')}>
                    Total Credited <SortIcon col="totalCredit" />
                  </th>
                  <th style={thStyle} onClick={() => handleSort('lastBalance')}>
                    Closing Balance <SortIcon col="lastBalance" />
                  </th>
                  <th style={thStyle} onClick={() => handleSort('txnCount')}>
                    Txns <SortIcon col="txnCount" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => (
                  <tr key={p.party_name} style={{ transition: 'background 0.1s' }}>
                    {/* BX-2: Party name is now a tappable button */}
                    <td style={tdLeftStyle}>
                      <button
                        onClick={() => goToLedger(p.party_name)}
                        className="font-medium text-left hover:underline transition-colors"
                        style={{ color: 'var(--brand)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                      >
                        {p.party_name}
                      </button>
                    </td>
                    <td style={tdStyle}>{fmt(p.totalDebit)}</td>
                    <td style={{ ...tdStyle, color: 'var(--success)' }}>{fmt(p.totalCredit)}</td>
                    <td style={tdStyle}>{fmt(p.lastBalance)}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                      {p.txnCount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-2">
            {visible.map(p => (
              <div
                key={p.party_name}
                className="rounded-xl p-3"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                {/* BX-2: Mobile party name as tappable button */}
                <button
                  onClick={() => goToLedger(p.party_name)}
                  className="text-sm font-medium mb-2 text-left w-full hover:underline"
                  style={{ color: 'var(--brand)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  {p.party_name}
                </button>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Debited</p>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {fmt(p.totalDebit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Credited</p>
                    <p className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                      {fmt(p.totalCredit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Closing Bal</p>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {fmt(p.lastBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Txns</p>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {p.txnCount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {sorted.length > showCount && (
            <button
              onClick={() => setShowCount(c => c + 50)}
              className="text-xs mx-auto block py-2 px-4 rounded-full transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                color:      'var(--text-secondary)',
                border:     '1px solid var(--border)',
              }}
            >
              Load more ({sorted.length - showCount} remaining)
            </button>
          )}

          {/* BX-10D: Most Active Month callout */}
          {mostActiveMonth && (
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-border)' }}
            >
              <BarChart2 size={15} style={{ color: 'var(--brand)', flexShrink: 0 }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                  Most Active Month
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {mostActiveMonth.label} — {mostActiveMonth.count.toLocaleString('en-IN')} transactions
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main AdminReports Component ──────────────────────────────────────────────

const TABS = [
  { id: 'overview',         label: 'Overview'          },
  { id: 'breakdown',        label: 'Period Breakdown'  },
  { id: 'payment_periods',  label: 'Payment Periods'   },
]

export default function AdminReports() {
  const { fetchPeriodSummary, fetchCurrentOutstanding, fetchAllLedger, fetchOutstandingPerParty } = useFinancialReports()

  // BX-9: useFinancial for dashboard cards
  const { debtors, creditors, syncLog, loading: finLoading, loadAll: loadFinancial } = useFinancial()
  useEffect(() => { loadFinancial() }, [loadFinancial])

  // AX-5: Landscape detection
  const [isLandscape, setIsLandscape] = useState(
    () => window.innerWidth > window.innerHeight
  )
  useEffect(() => {
    const handler = () => setIsLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Period state — default to This FY ─────────────────────────────────
  const defaultRange = getPresetRange('this_fy')
  const [from, setFrom] = useState(defaultRange.from)
  const [to,   setTo]   = useState(defaultRange.to)
  const [preset, setPreset] = useState('this_fy')

  // BX-1: All Time state
  const [isAllTime, setIsAllTime] = useState(false)

  // ── Data state ────────────────────────────────────────────────────────
  const [debtorRows,   setDebtorRows]   = useState([])
  const [creditorRows, setCreditorRows] = useState([])
  const [outstanding,  setOutstanding]  = useState({ debtorTotal: 0, creditorTotal: 0 })
  // BX-10A: per-party outstanding for Top Debtors list
  const [debtorOutstandingList, setDebtorOutstandingList] = useState([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [loaded,       setLoaded]       = useState(false)

  const [activeTab, setActiveTab] = useState('overview')

  // ── Fetch functions ───────────────────────────────────────────────────
  const load = useCallback(async (fromDate, toDate) => {
    if (!fromDate || !toDate) return
    setLoading(true)
    setError(null)
    try {
      const [period, out, debtorOuts] = await Promise.all([
        fetchPeriodSummary(fromDate, toDate),
        fetchCurrentOutstanding(),
        fetchOutstandingPerParty('debtor'),
      ])
      setDebtorRows(period.debtorRows)
      setCreditorRows(period.creditorRows)
      setOutstanding(out)
      setDebtorOutstandingList(debtorOuts)
      setLoaded(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchPeriodSummary, fetchCurrentOutstanding, fetchOutstandingPerParty])

  // BX-1: loadAllTime — no date filter
  const loadAllTime = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [period, out, debtorOuts] = await Promise.all([
        fetchAllLedger(),
        fetchCurrentOutstanding(),
        fetchOutstandingPerParty('debtor'),
      ])
      setDebtorRows(period.debtorRows)
      setCreditorRows(period.creditorRows)
      setOutstanding(out)
      setDebtorOutstandingList(debtorOuts)
      setLoaded(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fetchAllLedger, fetchCurrentOutstanding, fetchOutstandingPerParty])

  useEffect(() => {
    load(from, to)
  }, []) // only on mount; user triggers refresh via Apply Period

  // BX-1: Handle preset change — special case for all_time
  function handlePresetChange(p) {
    setPreset(p)
    if (p === 'all_time') {
      setIsAllTime(true)
      return
    }
    setIsAllTime(false)
    if (p !== 'custom') {
      const range = getPresetRange(p)
      setFrom(range.from)
      setTo(range.to)
    }
  }

  function handleFromChange(val) {
    setFrom(val)
    setPreset('custom')
    setIsAllTime(false)
  }

  function handleToChange(val) {
    setTo(val)
    setPreset('custom')
    setIsAllTime(false)
  }

  // BX-1: handleApply routes to all-time fetch when flag is set
  function handleApply() {
    if (isAllTime) {
      loadAllTime()
    } else {
      load(from, to)
    }
  }

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-y-auto animate-fade-in"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="max-w-5xl mx-auto w-full px-4 py-5 flex flex-col gap-5">

        {/* ── Page header ───────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1
              className="font-display font-semibold text-xl leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Reports
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Period analytics — synced from Tally
            </p>
          </div>
          <button
            onClick={handleApply}
            disabled={loading}
            className="btn-ghost text-xs flex items-center gap-1.5 flex-shrink-0"
            style={{ padding: '6px 14px' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Apply Period
          </button>
        </div>

        {/* ── BX-9: Dashboard cards (moved from AdminFinancial) ── */}
        <FinDashboardCards
          debtors={debtors}
          creditors={creditors}
          syncLog={syncLog}
          loading={finLoading}
        />

        {/* ── Period selector ──────────────────────────────── */}
        <PeriodSelector
          from={from}
          to={to}
          preset={preset}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
          onPresetChange={handlePresetChange}
          isAllTime={isAllTime}
          isLandscape={isLandscape}
        />

        {/* ── Error ─────────────────────────────────────────── */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: 'var(--error-light)', color: 'var(--error)' }}
          >
            Failed to load report data: {error}
          </div>
        )}

        {/* ── Internal tabs ─────────────────────────────────── */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex">
            {TABS.map(tab => {
              const isActive = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    color:        isActive ? 'var(--brand)' : 'var(--text-muted)',
                    borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                    marginBottom: '-1px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────── */}
        {!loaded && !loading && !error && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}

        {loading && !loaded && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}

        {(loaded || loading) && activeTab === 'overview' && (
          <OverviewTab
            debtorRows={debtorRows}
            creditorRows={creditorRows}
            outstanding={outstanding}
            debtorOutstandingList={debtorOutstandingList}
            loading={loading}
            isLandscape={isLandscape}
          />
        )}

        {(loaded || loading) && activeTab === 'breakdown' && (
          <PeriodBreakdownTab
            debtorRows={debtorRows}
            creditorRows={creditorRows}
            loading={loading}
          />
        )}

        {activeTab === 'payment_periods' && (
          <FinPaymentPeriodsTab />
        )}

      </div>
    </div>
  )
}
