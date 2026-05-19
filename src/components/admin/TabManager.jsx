/**
 * TabManager — inline component rendered below TabBar in AdminCatalogue.
 * Lets admin add a new tab or delete an existing one (with reconfirm + cascade warning).
 *
 * Props:
 *   categoryId        — number
 *   tabs              — array of { id, name }
 *   activeTabId       — number
 *   onTabAdded        — fn(newTab)
 *   onTabDeleted      — fn(tabId)
 *   onTabSelect       — fn(tabId)
 *   isReconfirmed     — bool (from useAuth)
 *   reconfirmIdentity — fn(password)
 *   writeCall         — fn(action, payload) — useCatalogueWrite
 *   writing           — bool
 */

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import PasswordReconfirm from './PasswordReconfirm'
import Spinner from '../ui/Spinner'
import { toast } from '../ui/Toast'

export default function TabManager({
  categoryId,
  tabs = [],
  activeTabId,
  onTabAdded,
  onTabDeleted,
  onTabSelect,
  isReconfirmed,
  reconfirmIdentity,
  writeCall,
  writing,
}) {
  const [addOpen, setAddOpen]       = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Delete flow state
  const [deleteTarget, setDeleteTarget]         = useState(null) // { id, name }
  const [reconfirmOpen, setReconfirmOpen]       = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteLoading, setDeleteLoading]       = useState(false)

  // ── Add tab ──────────────────────────────────────────────
  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!newTabName.trim()) return
    setAddLoading(true)
    try {
      const res = await writeCall('add-tab', { category_id: categoryId, name: newTabName.trim() })
      onTabAdded(res.data)
      setNewTabName('')
      setAddOpen(false)
      toast.success(`Tab "${res.data.name}" added`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAddLoading(false)
    }
  }

  // ── Delete: initiate ─────────────────────────────────────
  const handleDeleteClick = (tab) => {
    setDeleteTarget(tab)
    if (isReconfirmed) {
      setDeleteConfirmOpen(true)
    } else {
      setReconfirmOpen(true)
    }
  }

  // ── Delete: after reconfirm ──────────────────────────────
  const handleReconfirmed = () => {
    setReconfirmOpen(false)
    setDeleteConfirmOpen(true)
  }

  // ── Delete: execute ──────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await writeCall('delete-tab', { id: deleteTarget.id })
      onTabDeleted(deleteTarget.id)
      toast.success(`Tab "${deleteTarget.name}" deleted`)
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 flex-wrap"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
    >
      {/* Tab chips with delete */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className="flex items-center rounded-xl overflow-hidden text-sm font-medium"
          style={{
            border: `1px solid ${tab.id === activeTabId ? 'var(--brand-border)' : 'var(--border)'}`,
            background: tab.id === activeTabId ? 'var(--brand-light)' : 'var(--bg-surface)',
          }}
        >
          <button
            className="px-3 py-1.5 transition-colors"
            style={{ color: tab.id === activeTabId ? 'var(--brand)' : 'var(--text-primary)' }}
            onClick={() => onTabSelect(tab.id)}
          >
            {tab.name}
          </button>
          <button
            className="px-2 py-1.5 border-l transition-colors hover:opacity-70"
            style={{
              borderColor: tab.id === activeTabId ? 'var(--brand-border)' : 'var(--border)',
              color: 'var(--error)',
            }}
            onClick={() => handleDeleteClick(tab)}
            title="Delete tab"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {/* Add tab button */}
      {!addOpen ? (
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"
          style={{
            border: '1px dashed var(--border-strong)',
            color: 'var(--text-muted)',
          }}
          onClick={() => setAddOpen(true)}
        >
          <Plus size={14} /> Add Tab
        </button>
      ) : (
        <form onSubmit={handleAddSubmit} className="flex items-center gap-2">
          <input
            type="text"
            className="input-field py-1.5 text-sm"
            style={{ width: '160px' }}
            placeholder="Tab name"
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            autoFocus
            disabled={addLoading}
          />
          <button type="submit" className="btn-primary py-1.5 px-3 text-sm" disabled={addLoading || !newTabName.trim()}>
            {addLoading ? <Spinner size={14} color="var(--text-inverse)" /> : 'Add'}
          </button>
          <button type="button" className="btn-ghost py-1.5 px-3 text-sm" onClick={() => { setAddOpen(false); setNewTabName('') }}>
            Cancel
          </button>
        </form>
      )}

      {/* Password reconfirm modal */}
      <PasswordReconfirm
        open={reconfirmOpen}
        onClose={() => { setReconfirmOpen(false); setDeleteTarget(null) }}
        onConfirmed={handleReconfirmed}
        reconfirmIdentity={reconfirmIdentity}
        title="Confirm before deleting tab"
        description={`Deleting "${deleteTarget?.name}" will permanently remove all items inside it. Enter your password to proceed.`}
      />

      {/* Cascade warning + delete confirm */}
      <Modal
        open={deleteConfirmOpen}
        onClose={!deleteLoading ? () => { setDeleteConfirmOpen(false); setDeleteTarget(null) } : undefined}
        title="Delete tab?"
        maxWidth="max-w-sm"
      >
        <div
          className="rounded-xl p-3 mb-4 text-sm"
          style={{ background: 'var(--error-light)', color: 'var(--error)' }}
        >
          <strong>⚠️ This will permanently delete:</strong>
          <ul className="mt-1 ml-4 list-disc text-xs" style={{ color: 'var(--error)' }}>
            <li>Tab: <strong>{deleteTarget?.name}</strong></li>
            <li>All items inside this tab</li>
          </ul>
          <p className="mt-1 text-xs">This cannot be undone.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost flex-1"
            onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null) }}
            disabled={deleteLoading}
          >
            Cancel
          </button>
          <button
            className="btn-primary flex-1"
            style={{ background: 'var(--error)' }}
            onClick={handleDeleteConfirm}
            disabled={deleteLoading}
          >
            {deleteLoading ? <><Spinner size={15} color="var(--text-inverse)" /> Deleting…</> : 'Yes, Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
