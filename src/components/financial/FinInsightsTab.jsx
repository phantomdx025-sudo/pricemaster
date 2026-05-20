/**
 * FinInsightsTab — Auto-computed analytics for a single party.
 * Phase FIN-7: New 4th tab in FinSlideOver.
 *
 * Props:
 *   party           — fin_parties row
 *   partyType       — 'debtor' | 'creditor'
 *   ledgerRows      — rows from fin_ledger (may be [] if not yet loaded; triggers own load)
 *   outstandingRows — rows from fin_outstanding (may be [] if not yet loaded; triggers own load)
 *   fetchLedger     — fn(partyType, partyName) → Promise<rows>
 *   fetchOutstanding — fn(partyType, partyName) → Promise<rows>
 *   onLedgerLoaded  — fn(rows) — updates FinSlideOver cachedLedger
 */
import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Minus,
  Calendar, Clock, CreditCard,
  BarChart2, AlertCircle, CheckCircle,
  ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react'

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date)) return String(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

// Determine the Indian financial year for a date: Apr–Mar
function financialYear(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const m = d.getMonth() // 0-indexed
  const y = d.getFullYear()
  return m >= 3 ? y : y - 1 // FY starts April (month 3)
}

function currentFY() {
  return financialYear(new Date())
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function InsightSkeleton() {
  return (
    <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-3 animate-pulse"
          style={{ background: 'var(--bg-elevated)', minHeight: '80px' }}
        />
      ))}
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, iconColor, iconBg, label, value, sub, wide }) {
  return (
    <div
      className={`rounded-xl p-3 flex flex-col gap-2 ${wide ? 'col-span-2 md:col-span-3' : ''}`}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg ?? 'var(--brand-light)' }}
        >
          <Icon size={14} style={{ color: iconColor ?? 'var(--brand)' }} />
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div>
        <p
          className="text-sm font-semibold leading-snug break-words"
          style={{ color: 'var(--text-primary)' }}
        >
          {value ?? '—'}
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

// ── Sparkline (6-bar SVG chart) ───────────────────────────────────────────────
// bars: array of { label: 'Jan', value: number }
function Sparkline({ bars, label }) {
  const max = Math.max(...bars.map(b => b.value), 1)
  const BAR_W = 28
  const GAP   = 6
  const H     = 56
  const totalW = bars.length * (BAR_W + GAP) - GAP

  return (
    <div
      className="rounded-xl p-3 col-span-2 md:col-span-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {max === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No data</p>
      ) : (
        <svg
          viewBox={`0 0 ${totalW} ${H + 20}`}
          width="100%"
          style={{ overflow: 'visible' }}
          aria-label={label}
        >
          {bars.map((b, i) => {
            const barH = max > 0 ? Math.max(4, Math.round((b.value / max) * H)) : 4
            const x = i * (BAR_W + GAP)
            const y = H - barH
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={barH}
                  rx={4}
                  fill="var(--brand)"
                  opacity={b.value === 0 ? 0.2 : 0.85}
                />
                <text
                  x={x + BAR_W / 2}
                  y={H + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--text-muted)"
                >
                  {b.label}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

// ── Payment trend helper ──────────────────────────────────────────────────────
function paymentTrend(bars) {
  if (bars.length < 2) return 'stable'
  const last3  = bars.slice(-3).map(b => b.value)
  const first3 = bars.slice(0, 3).map(b => b.value)
  const avgLast  = last3.reduce((a, b) => a + b, 0) / last3.length
  const avgFirst = first3.reduce((a, b) => a + b, 0) / first3.length
  if (avgLast > avgFirst * 1.15) return 'increasing'
  if (avgLast < avgFirst * 0.85) return 'decreasing'
  return 'stable'
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function FinInsightsTab({
  party,
  partyType,
  ledgerRows,
  outstandingRows,
  fetchLedger,
  fetchOutstanding,
  onLedgerLoaded,
}) {
  const [localLedger,      setLocalLedger]      = useState(ledgerRows ?? [])
  const [localOutstanding, setLocalOutstanding]  = useState(outstandingRows ?? [])
  const [loadingLedger,    setLoadingLedger]     = useState(false)
  const [loadingOut,       setLoadingOut]        = useState(false)
  const [error,            setError]             = useState(null)

  const partyName = party?.party_name ?? ''
  const pType     = party?.party_type ?? partyType

  // Load ledger if not already provided / cached
  useEffect(() => {
    if (localLedger.length === 0 && partyName) {
      setLoadingLedger(true)
      fetchLedger(pType, partyName)
        .then(rows => {
          setLocalLedger(rows)
          if (onLedgerLoaded) onLedgerLoaded(rows)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoadingLedger(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyName, pType])

  // Sync in if parent cached ledger fills in later
  useEffect(() => {
    if (ledgerRows && ledgerRows.length > 0 && localLedger.length === 0) {
      setLocalLedger(ledgerRows)
    }
  }, [ledgerRows])

  // Load outstanding if empty
  useEffect(() => {
    if (localOutstanding.length === 0 && partyName) {
      setLoadingOut(true)
      fetchOutstanding(pType, partyName)
        .then(rows => setLocalOutstanding(rows))
        .catch(() => {}) // non-critical
        .finally(() => setLoadingOut(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyName, pType])

  // ── Compute metrics ───────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const rows      = localLedger
    const outstRows = localOutstanding
    const thisYear  = currentFY()
    const lastYear  = thisYear - 1

    if (pType === 'debtor') {
      // Last credit (payment received from debtor)
      const creditRows = rows.filter(r => (r.credit ?? 0) > 0)
      const lastCredit = creditRows[creditRows.length - 1] ?? null

      // Days since last payment
      const daysSincePayment = lastCredit ? daysSince(lastCredit.txn_date) : null

      // Oldest outstanding invoice age
      const outstandingAges = outstRows
        .map(r => r.inv_date ? daysSince(r.inv_date) : null)
        .filter(Boolean)
      const oldestInvoiceAge = outstandingAges.length > 0 ? Math.max(...outstandingAges) : null

      // Invoice count this FY vs last FY (debit rows = invoices sent)
      const debitRows = rows.filter(r => (r.debit ?? 0) > 0)
      const invoicesThisYear = debitRows.filter(r => r.txn_date && financialYear(r.txn_date) === thisYear).length
      const invoicesLastYear = debitRows.filter(r => r.txn_date && financialYear(r.txn_date) === lastYear).length

      // Monthly payment sparkline — last 6 months credits
      const now = new Date()
      const MONTHS = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        return {
          year: d.getFullYear(),
          month: d.getMonth(),
          label: d.toLocaleDateString('en-IN', { month: 'short' }),
          value: 0,
        }
      })
      creditRows.forEach(r => {
        if (!r.txn_date) return
        const d = new Date(r.txn_date)
        const slot = MONTHS.find(m => m.year === d.getFullYear() && m.month === d.getMonth())
        if (slot) slot.value += r.credit ?? 0
      })

      const trend = paymentTrend(MONTHS)

      // Average days to pay: gap between invoice (debit) and matching receipt (credit)
      // Simple proxy: if any debit/credit pairs exist in same month, compute avg gap
      // More practical: use all credit rows that have a corresponding invoice via vch_no reference
      // (Tally doesn't always provide a direct link so we approximate)
      // Average gap between consecutive debit and next credit
      let avgDaysToPay = null
      if (debitRows.length > 0 && creditRows.length > 0) {
        const gaps = []
        debitRows.forEach(dr => {
          const drDate = new Date(dr.txn_date)
          // Find the closest credit row after this debit
          const matching = creditRows.find(cr => new Date(cr.txn_date) >= drDate)
          if (matching) {
            const gap = Math.round((new Date(matching.txn_date) - drDate) / 86400000)
            if (gap >= 0 && gap < 730) gaps.push(gap) // cap at 2 years
          }
        })
        if (gaps.length > 0) {
          avgDaysToPay = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
        }
      }

      return {
        type: 'debtor',
        lastPaymentDate: lastCredit?.txn_date ?? null,
        lastPaymentAmt: lastCredit?.credit ?? null,
        daysSincePayment,
        oldestInvoiceAge,
        invoicesThisYear,
        invoicesLastYear,
        sparklineBars: MONTHS,
        trend,
        avgDaysToPay,
      }
    } else {
      // Creditor: debit rows = payments made to creditor
      const debitRows  = rows.filter(r => (r.debit ?? 0) > 0)
      const lastDebit  = debitRows[debitRows.length - 1] ?? null

      const daysSincePayment = lastDebit ? daysSince(lastDebit.txn_date) : null

      const thisYear  = currentFY()
      const totalPaidThisYear = debitRows
        .filter(r => r.txn_date && financialYear(r.txn_date) === thisYear)
        .reduce((sum, r) => sum + (r.debit ?? 0), 0)

      const largestPayable = outstRows.length > 0
        ? Math.max(...outstRows.map(r => r.remaining ?? 0))
        : null

      return {
        type: 'creditor',
        lastPaymentDate: lastDebit?.txn_date ?? null,
        lastPaymentAmt: lastDebit?.debit ?? null,
        daysSincePayment,
        totalPaidThisYear,
        largestPayable,
      }
    }
  }, [localLedger, localOutstanding, pType])

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingLedger) return <InsightSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
        <AlertCircle size={28} style={{ color: 'var(--error)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Failed to load ledger data: {error}
        </p>
      </div>
    )
  }

  if (localLedger.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
        <BarChart2 size={32} style={{ color: 'var(--border-strong)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No ledger data to analyse.
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Sync ledger data for this party to see insights.
        </p>
      </div>
    )
  }

  // ── Debtor metrics render ─────────────────────────────────────────────────
  if (metrics.type === 'debtor') {
    const {
      lastPaymentDate, lastPaymentAmt, daysSincePayment,
      oldestInvoiceAge, invoicesThisYear, invoicesLastYear,
      sparklineBars, trend, avgDaysToPay,
    } = metrics

    const trendIcon  = trend === 'increasing' ? TrendingUp : trend === 'decreasing' ? TrendingDown : Minus
    const trendColor = trend === 'increasing' ? 'var(--success)' : trend === 'decreasing' ? 'var(--error)' : 'var(--text-muted)'
    const trendBg    = trend === 'increasing' ? 'var(--success-light)' : trend === 'decreasing' ? 'var(--error-light)' : 'var(--bg-elevated)'
    const trendLabel = trend === 'increasing' ? 'Payments increasing ↑' : trend === 'decreasing' ? 'Payments decreasing ↓' : 'Payments stable →'

    const ageColor = !oldestInvoiceAge ? 'var(--success)' :
      oldestInvoiceAge > 90 ? 'var(--error)' :
      oldestInvoiceAge > 60 ? 'var(--warning)' : 'var(--brand)'
    const ageBg = !oldestInvoiceAge ? 'var(--success-light)' :
      oldestInvoiceAge > 90 ? 'var(--error-light)' :
      oldestInvoiceAge > 60 ? 'var(--warning-light)' : 'var(--brand-light)'

    return (
      <div className="p-4">
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
          DEBTOR INSIGHTS
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

          {/* Last payment received */}
          <MetricCard
            icon={ArrowDownCircle}
            iconColor="var(--success)"
            iconBg="var(--success-light)"
            label="Last payment received"
            value={lastPaymentAmt ? fmt(lastPaymentAmt) : 'None'}
            sub={lastPaymentDate ? fmtDate(lastPaymentDate) : 'No payments on record'}
          />

          {/* Days since payment */}
          <MetricCard
            icon={Clock}
            iconColor={daysSincePayment == null ? 'var(--text-muted)' : daysSincePayment > 90 ? 'var(--error)' : daysSincePayment > 30 ? 'var(--warning)' : 'var(--success)'}
            iconBg={daysSincePayment == null ? 'var(--bg-elevated)' : daysSincePayment > 90 ? 'var(--error-light)' : daysSincePayment > 30 ? 'var(--warning-light)' : 'var(--success-light)'}
            label="Days since last payment"
            value={daysSincePayment != null ? `${daysSincePayment} days` : '—'}
            sub={daysSincePayment == null ? 'No payments on record' : daysSincePayment > 90 ? 'Overdue — follow up' : daysSincePayment > 30 ? 'Getting late' : 'Recent payment'}
          />

          {/* Oldest outstanding invoice */}
          <MetricCard
            icon={AlertCircle}
            iconColor={ageColor}
            iconBg={ageBg}
            label="Oldest outstanding invoice"
            value={loadingOut ? 'Loading…' : oldestInvoiceAge != null ? `${oldestInvoiceAge} days old` : 'None'}
            sub={oldestInvoiceAge == null ? 'All invoices cleared' : oldestInvoiceAge > 90 ? 'Critical — very overdue' : oldestInvoiceAge > 60 ? 'Overdue' : 'Within terms'}
          />

          {/* Invoices this FY vs last FY */}
          <MetricCard
            icon={CreditCard}
            iconColor="var(--brand)"
            iconBg="var(--brand-light)"
            label="Invoices this FY"
            value={String(invoicesThisYear)}
            sub={`${invoicesLastYear} last FY • ${
              invoicesThisYear > invoicesLastYear ? '↑ more active' :
              invoicesThisYear < invoicesLastYear ? '↓ less active' : '≈ same as last year'
            }`}
          />

          {/* Average days to pay */}
          <MetricCard
            icon={Calendar}
            iconColor="var(--brand)"
            iconBg="var(--brand-light)"
            label="Avg. days to pay"
            value={avgDaysToPay != null ? `${avgDaysToPay} days` : '—'}
            sub={avgDaysToPay == null ? 'Not enough data' :
              avgDaysToPay <= 30 ? 'Pays promptly' :
              avgDaysToPay <= 60 ? 'Moderate delay' : 'Slow payer'}
          />

          {/* Payment trend indicator */}
          <MetricCard
            icon={trendIcon}
            iconColor={trendColor}
            iconBg={trendBg}
            label="6-month payment trend"
            value={trendLabel}
            sub="Based on credit entries"
          />

          {/* Monthly sparkline */}
          <Sparkline bars={sparklineBars} label="Monthly payments received (last 6 months)" />

        </div>
      </div>
    )
  }

  // ── Creditor metrics render ───────────────────────────────────────────────
  const {
    lastPaymentDate, lastPaymentAmt, daysSincePayment,
    totalPaidThisYear, largestPayable,
  } = metrics

  return (
    <div className="p-4">
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
        CREDITOR INSIGHTS
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

        {/* Last payment made */}
        <MetricCard
          icon={ArrowUpCircle}
          iconColor="var(--error)"
          iconBg="var(--error-light)"
          label="Last payment made"
          value={lastPaymentAmt ? fmt(lastPaymentAmt) : 'None'}
          sub={lastPaymentDate ? fmtDate(lastPaymentDate) : 'No payments on record'}
        />

        {/* Days since last payment */}
        <MetricCard
          icon={Clock}
          iconColor={daysSincePayment == null ? 'var(--text-muted)' : daysSincePayment > 60 ? 'var(--error)' : 'var(--success)'}
          iconBg={daysSincePayment == null ? 'var(--bg-elevated)' : daysSincePayment > 60 ? 'var(--error-light)' : 'var(--success-light)'}
          label="Days since last payment"
          value={daysSincePayment != null ? `${daysSincePayment} days` : '—'}
          sub={daysSincePayment == null ? 'No payment history' : daysSincePayment > 60 ? 'Due — pay soon' : 'Paid recently'}
        />

        {/* Total paid this FY */}
        <MetricCard
          icon={CheckCircle}
          iconColor="var(--success)"
          iconBg="var(--success-light)"
          label="Total paid this FY"
          value={fmt(totalPaidThisYear)}
          sub={`April ${currentFY()} – March ${currentFY() + 1}`}
        />

        {/* Largest single payable */}
        <MetricCard
          icon={AlertCircle}
          iconColor={largestPayable == null ? 'var(--success)' : largestPayable > 100000 ? 'var(--error)' : 'var(--warning)'}
          iconBg={largestPayable == null ? 'var(--success-light)' : largestPayable > 100000 ? 'var(--error-light)' : 'var(--warning-light)'}
          label="Largest single payable"
          value={loadingOut ? 'Loading…' : largestPayable != null ? fmt(largestPayable) : 'None'}
          sub={largestPayable == null ? 'No outstanding balance' : largestPayable > 100000 ? 'High amount due' : 'Moderate amount due'}
        />

      </div>
    </div>
  )
}
