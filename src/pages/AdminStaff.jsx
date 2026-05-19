/**
 * AdminStaff — staff management page embedded inside AdminPanel.
 * Rendered as a flex content pane (no full-page layout of its own).
 *
 * Features:
 * - Initial staff list load via staff-write edge function (action: 'list')
 * - Realtime subscription on staff_users table — new signups appear instantly
 * - Toast when a new signup arrives
 * - Approve / Revoke / Delete actions via staff-write edge function
 * - Confirm modal before delete
 * - Loading state while initial fetch is in flight
 */

import { useState, useEffect, useCallback } from 'react'
import { Users, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStaffWrite } from '../hooks/useStaffWrite'
import StaffApprovalList from '../components/admin/StaffApprovalList'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { toast } from '../components/ui/Toast'

export default function AdminStaff() {
  const [staff, setStaff] = useState([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingIds, setLoadingIds] = useState(new Set())
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, name }
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { call } = useStaffWrite()

  // ── Load all staff ───────────────────────────────────────
  const loadStaff = useCallback(async (silent = false) => {
    if (!silent) setLoadingInitial(true)
    try {
      const result = await call('list')
      setStaff(result.data ?? [])
    } catch (err) {
      toast.error('Failed to load staff: ' + (err.message ?? 'Unknown error'))
    } finally {
      setLoadingInitial(false)
    }
  }, [call])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  // ── Realtime subscription ────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('staff-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_users' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // New signup: add to local state + show toast
            const newMember = payload.new
            setStaff(prev => {
              // Avoid duplicates (realtime can sometimes fire twice)
              if (prev.find(s => s.id === newMember.id)) return prev
              return [newMember, ...prev]
            })
            toast(`New signup: ${newMember.name} (${newMember.designation})`, {
              icon: '🔔',
              duration: 5000,
            })
          } else if (payload.eventType === 'UPDATE') {
            setStaff(prev =>
              prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s)
            )
          } else if (payload.eventType === 'DELETE') {
            setStaff(prev => prev.filter(s => s.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ── Mutations ────────────────────────────────────────────
  const withLoadingId = async (id, fn) => {
    setLoadingIds(prev => new Set([...prev, id]))
    try {
      await fn()
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleApprove = (id) => withLoadingId(id, async () => {
    try {
      const result = await call('approve', { id })
      setStaff(prev => prev.map(s => s.id === id ? result.data : s))
      toast.success(`${result.data.name} approved`)
    } catch (err) {
      toast.error('Approve failed: ' + (err.message ?? 'Unknown error'))
    }
  })

  const handleRevoke = (id) => withLoadingId(id, async () => {
    try {
      const result = await call('revoke', { id })
      setStaff(prev => prev.map(s => s.id === id ? result.data : s))
      toast(`Access revoked for ${result.data.name}`, { icon: '🔒' })
    } catch (err) {
      toast.error('Revoke failed: ' + (err.message ?? 'Unknown error'))
    }
  })

  const handleDeleteRequest = (id) => {
    const member = staff.find(s => s.id === id)
    setDeleteTarget({ id, name: member?.name ?? 'this staff member' })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await call('delete', { id: deleteTarget.id })
      setStaff(prev => prev.filter(s => s.id !== deleteTarget.id))
      toast.success(`${deleteTarget.name} removed`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error('Delete failed: ' + (err.message ?? 'Unknown error'))
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} style={{ color: 'var(--brand)' }} />
            <h1 className="font-display font-semibold text-xl" style={{ color: 'var(--text-primary)' }}>
              Staff Management
            </h1>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            onClick={() => loadStaff(true)}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Summary chips */}
        {!loadingInitial && (
          <div className="flex gap-2 flex-wrap">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand)' }} />
              {staff.filter(s => !s.approved).length} pending
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'var(--success-light)', color: 'var(--success)', border: '1px solid var(--success)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              {staff.filter(s => s.approved).length} active
            </div>
          </div>
        )}

        {/* Loading state */}
        {loadingInitial ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Spinner size={28} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading staff…</p>
            </div>
          </div>
        ) : (
          <StaffApprovalList
            staff={staff}
            onApprove={handleApprove}
            onRevoke={handleRevoke}
            onDelete={handleDeleteRequest}
            loadingIds={loadingIds}
          />
        )}
      </div>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={deleteLoading ? undefined : () => setDeleteTarget(null)}
        title="Delete staff member?"
        maxWidth="max-w-sm"
      >
        <div
          className="rounded-xl p-3 mb-4 text-sm"
          style={{ background: 'var(--error-light)', color: 'var(--error)', border: '1px solid var(--error)' }}
        >
          <strong>{deleteTarget?.name}</strong>'s account will be permanently deleted. They will no longer be able to log in.
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost flex-1"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteLoading}
          >
            Cancel
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all"
            style={{ background: 'var(--error)', color: '#fff' }}
            onClick={handleDeleteConfirm}
            disabled={deleteLoading}
          >
            {deleteLoading ? <><Spinner size={15} color="#fff" /> Deleting…</> : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
