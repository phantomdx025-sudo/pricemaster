/**
 * CategoryManager — modal for adding/deleting categories.
 * Lives as a modal triggered from a button in the admin sidebar area.
 *
 * Props:
 *   open              — bool
 *   onClose           — fn()
 *   categories        — array of { id, name, icon }
 *   activeCategoryId  — number
 *   onCategoryAdded   — fn(newCat)
 *   onCategoryDeleted — fn(catId)
 *   isReconfirmed     — bool
 *   reconfirmIdentity — fn(password)
 *   writeCall         — fn(action, payload)
 */

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import PasswordReconfirm from './PasswordReconfirm'
import Spinner from '../ui/Spinner'
import { toast } from '../ui/Toast'

export default function CategoryManager({
  open,
  onClose,
  categories = [],
  activeCategoryId,
  onCategoryAdded,
  onCategoryDeleted,
  isReconfirmed,
  reconfirmIdentity,
  writeCall,
}) {
  // Add state
  const [addName, setAddName]   = useState('')
  const [addIcon, setAddIcon]   = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Delete flow
  const [deleteTarget, setDeleteTarget]           = useState(null)
  const [reconfirmOpen, setReconfirmOpen]         = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteLoading, setDeleteLoading]         = useState(false)

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!addName.trim()) return
    setAddLoading(true)
    try {
      const res = await writeCall('add-category', { name: addName.trim(), icon: addIcon.trim() || null })
      onCategoryAdded(res.data)
      setAddName('')
      setAddIcon('')
      setShowAddForm(false)
      toast.success(`Category "${res.data.name}" added`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteClick = (cat) => {
    setDeleteTarget(cat)
    if (isReconfirmed) {
      setDeleteConfirmOpen(true)
    } else {
      setReconfirmOpen(true)
    }
  }

  const handleReconfirmed = () => {
    setReconfirmOpen(false)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await writeCall('delete-category', { id: deleteTarget.id })
      onCategoryDeleted(deleteTarget.id)
      toast.success(`Category "${deleteTarget.name}" deleted`)
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Manage Categories" maxWidth="max-w-md">
        {/* Category list */}
        <div className="flex flex-col gap-1 mb-4 max-h-60 overflow-y-auto">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{
                background: cat.id === activeCategoryId ? 'var(--brand-light)' : 'var(--bg-elevated)',
                border: `1px solid ${cat.id === activeCategoryId ? 'var(--brand-border)' : 'var(--border)'}`,
              }}
            >
              {cat.icon && <span className="text-base leading-none">{cat.icon}</span>}
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {cat.name}
              </span>
              <button
                className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                style={{ color: 'var(--error)' }}
                onClick={() => handleDeleteClick(cat)}
                title="Delete category"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
              No categories yet.
            </p>
          )}
        </div>

        {/* Add form */}
        {showAddForm ? (
          <form onSubmit={handleAddSubmit} className="flex flex-col gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Category Name <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Suiting Fabric"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  disabled={addLoading}
                  autoFocus
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="label">Icon (emoji, optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 🧵"
                  value={addIcon}
                  onChange={(e) => setAddIcon(e.target.value)}
                  disabled={addLoading}
                  maxLength={4}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => { setShowAddForm(false); setAddName(''); setAddIcon('') }} disabled={addLoading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={addLoading || !addName.trim()}>
                {addLoading ? <><Spinner size={15} color="var(--text-inverse)" /> Adding…</> : 'Add Category'}
              </button>
            </div>
          </form>
        ) : (
          <button
            className="w-full btn-ghost flex items-center justify-center gap-2 mt-1"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={16} /> Add New Category
          </button>
        )}
      </Modal>

      {/* Password reconfirm */}
      <PasswordReconfirm
        open={reconfirmOpen}
        onClose={() => { setReconfirmOpen(false); setDeleteTarget(null) }}
        onConfirmed={handleReconfirmed}
        reconfirmIdentity={reconfirmIdentity}
        title="Confirm before deleting category"
        description={`Deleting "${deleteTarget?.name}" will permanently remove all its tabs and every item inside them. Enter your password to proceed.`}
      />

      {/* Cascade warning + delete confirm */}
      <Modal
        open={deleteConfirmOpen}
        onClose={!deleteLoading ? () => { setDeleteConfirmOpen(false); setDeleteTarget(null) } : undefined}
        title="Delete category?"
        maxWidth="max-w-sm"
      >
        <div
          className="rounded-xl p-3 mb-4 text-sm"
          style={{ background: 'var(--error-light)', color: 'var(--error)' }}
        >
          <strong>⚠️ This will permanently delete:</strong>
          <ul className="mt-1 ml-4 list-disc text-xs" style={{ color: 'var(--error)' }}>
            <li>Category: <strong>{deleteTarget?.name}</strong></li>
            <li>All tabs in this category</li>
            <li>All items in those tabs</li>
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
    </>
  )
}
