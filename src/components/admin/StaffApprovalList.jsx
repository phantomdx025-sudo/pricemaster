/**
 * StaffApprovalList — two-section list for admin staff management.
 * Pending signups: Approve / Delete buttons.
 * Approved staff: Revoke / Delete buttons.
 *
 * Props:
 *   staff        — array of all staff_user rows
 *   onApprove    — fn(id)
 *   onRevoke     — fn(id)
 *   onDelete     — fn(id)
 *   loadingIds   — Set of ids with in-flight mutations
 */

import { Clock, CheckCircle, Phone, Briefcase, ShieldOff, Trash2, Check } from 'lucide-react'
import Spinner from '../ui/Spinner'

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function StaffCard({ member, onApprove, onRevoke, onDelete, loading }) {
  const isPending = !member.approved

  return (
    <div
      className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${isPending ? 'var(--brand-border)' : 'var(--border)'}`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: isPending ? 'var(--warning-light)' : 'var(--success-light)',
          border: `1.5px solid ${isPending ? 'var(--brand-border)' : 'var(--success)'}`,
        }}
      >
        <span
          className="font-display font-semibold text-sm"
          style={{ color: isPending ? 'var(--brand)' : 'var(--success)' }}
        >
          {member.name?.charAt(0)?.toUpperCase() ?? '?'}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
          {member.name}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Phone size={11} />{member.phone}
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Briefcase size={11} />{member.designation}
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          <Clock size={11} className="inline mr-1" style={{ verticalAlign: '-1px' }} />
          {formatTime(member.created_at)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isPending ? (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: 'var(--success)',
              color: '#fff',
              opacity: loading ? 0.7 : 1,
            }}
            onClick={() => onApprove(member.id)}
            disabled={loading}
            title="Approve"
          >
            {loading ? <Spinner size={12} color="#fff" /> : <Check size={13} />}
            Approve
          </button>
        ) : (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: 'var(--warning-light)',
              color: 'var(--brand)',
              border: '1px solid var(--brand-border)',
              opacity: loading ? 0.7 : 1,
            }}
            onClick={() => onRevoke(member.id)}
            disabled={loading}
            title="Revoke access"
          >
            {loading ? <Spinner size={12} color="var(--brand)" /> : <ShieldOff size={13} />}
            Revoke
          </button>
        )}

        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{
            background: 'var(--error-light)',
            color: 'var(--error)',
            opacity: loading ? 0.5 : 1,
          }}
          onClick={() => onDelete(member.id)}
          disabled={loading}
          title="Delete account"
        >
          {loading ? <Spinner size={12} color="var(--error)" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  )
}

export default function StaffApprovalList({ staff, onApprove, onRevoke, onDelete, loadingIds }) {
  const pending = staff.filter(s => !s.approved)
  const approved = staff.filter(s => s.approved)

  return (
    <div className="flex flex-col gap-8">
      {/* ── Pending Signups ───────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} style={{ color: 'var(--brand)' }} />
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            Pending Approval
          </h2>
          {pending.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: 'var(--brand)', color: '#fff' }}
            >
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
          >
            <div className="text-2xl mb-2">🎉</div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No pending requests — you're all caught up.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map(member => (
              <StaffCard
                key={member.id}
                member={member}
                onApprove={onApprove}
                onRevoke={onRevoke}
                onDelete={onDelete}
                loading={loadingIds.has(member.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Approved Staff ─────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle size={16} style={{ color: 'var(--success)' }} />
          <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            Active Staff
          </h2>
          {approved.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: 'var(--success-light)', color: 'var(--success)', border: '1px solid var(--success)' }}
            >
              {approved.length}
            </span>
          )}
        </div>

        {approved.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
          >
            <div className="text-2xl mb-2">👤</div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No approved staff yet. Approve a request above to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {approved.map(member => (
              <StaffCard
                key={member.id}
                member={member}
                onApprove={onApprove}
                onRevoke={onRevoke}
                onDelete={onDelete}
                loading={loadingIds.has(member.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
