/**
 * PasswordReconfirm — modal that re-authenticates the admin before a destructive action.
 * Uses Supabase Auth `signInWithPassword` with the current session's email.
 * On success: calls onConfirmed(). Cached externally via isReconfirmed/reconfirmedAt.
 *
 * Props:
 *   open           — bool
 *   onClose        — fn()
 *   onConfirmed    — fn()  — called when password is verified
 *   reconfirmIdentity — fn(password) → { success, error } — from useAuth
 *   title          — string  (optional context label)
 *   description    — string
 */

import { useState } from 'react'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'
import Modal from '../ui/Modal'
import Spinner from '../ui/Spinner'

export default function PasswordReconfirm({
  open,
  onClose,
  onConfirmed,
  reconfirmIdentity,
  title = 'Confirm your identity',
  description = 'Enter your admin password to continue.',
}) {
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const handleClose = () => {
    setPassword('')
    setErr('')
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setErr('')
    const result = await reconfirmIdentity(password)
    setLoading(false)
    if (result.success) {
      setPassword('')
      onConfirmed()
    } else {
      setErr(result.error ?? 'Incorrect password')
    }
  }

  return (
    <Modal open={open} onClose={!loading ? handleClose : undefined} title={null} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center gap-3 mb-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--warning-light)', border: '1px solid var(--brand-border)' }}
        >
          <ShieldCheck size={22} style={{ color: 'var(--brand)' }} />
        </div>
        <div>
          <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="label">Admin Password</label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              className="input-field pr-10"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErr('') }}
              disabled={loading}
              autoFocus
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setShowPwd(v => !v)}
              tabIndex={-1}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {err && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--error)' }}>{err}</p>
          )}
        </div>

        <div className="flex gap-2 mt-1">
          <button type="button" className="btn-ghost flex-1" onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={loading || !password}>
            {loading ? <><Spinner size={15} color="var(--text-inverse)" /> Checking…</> : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
