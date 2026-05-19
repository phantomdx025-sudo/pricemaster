/**
 * FinDashboardCards — 4 summary cards for the Financial Reports page.
 * Cards: Total Receivable, Total Payable, Outstanding Parties, Last Synced.
 */
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react'
import Skeleton from '../ui/Skeleton'

const fmt = (n) =>
  `₹${Math.abs(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function formatSyncDate(syncLog) {
  // Find most recent successful sync across all file types
  const entry = (syncLog ?? []).find(r => r.status === 'success')
  if (!entry) return 'Never synced'
  const d = new Date(entry.synced_at)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function Card({ icon, label, value, sub, color, loading }) {
  return (
    <div
      className="card-elevated flex items-start gap-3 p-4"
      style={{ minWidth: 0 }}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: color + '22', color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-5 w-24 rounded mt-1" />
        ) : (
          <p className="font-mono font-semibold text-base leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
            {value}
          </p>
        )}
        {sub && !loading && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{sub}</p>
        )}
      </div>
    </div>
  )
}

export default function FinDashboardCards({ debtors, creditors, syncLog, loading }) {
  const totalReceivable = (debtors ?? [])
    .filter(p => p.status === 'Receivable')
    .reduce((sum, p) => sum + (p.closing_bal ?? 0), 0)

  const totalPayable = (creditors ?? [])
    .filter(p => p.status === 'Payable')
    .reduce((sum, p) => sum + (p.closing_bal ?? 0), 0)

  const outstandingParties =
    (debtors ?? []).filter(p => (p.closing_bal ?? 0) > 0).length +
    (creditors ?? []).filter(p => (p.closing_bal ?? 0) > 0).length

  const receivableCount = (debtors ?? []).filter(p => p.status === 'Receivable').length
  const payableCount    = (creditors ?? []).filter(p => p.status === 'Payable').length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        icon={<TrendingUp size={17} />}
        label="Total Receivable"
        value={fmt(totalReceivable)}
        sub={`${receivableCount} part${receivableCount !== 1 ? 'ies' : 'y'}`}
        color="var(--brand)"
        loading={loading}
      />
      <Card
        icon={<TrendingDown size={17} />}
        label="Total Payable"
        value={fmt(totalPayable)}
        sub={`${payableCount} vendor${payableCount !== 1 ? 's' : ''}`}
        color="var(--error)"
        loading={loading}
      />
      <Card
        icon={<AlertCircle size={17} />}
        label="Outstanding Parties"
        value={loading ? '—' : String(outstandingParties)}
        sub="with open balance"
        color="var(--warning)"
        loading={loading}
      />
      <Card
        icon={<RefreshCw size={17} />}
        label="Last Synced"
        value={loading ? '—' : formatSyncDate(syncLog)}
        color="var(--success)"
        loading={loading}
      />
    </div>
  )
}
