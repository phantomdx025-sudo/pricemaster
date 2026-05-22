/**
 * FinLabelManager — Modal for creating and deleting custom labels.
 *
 * Props:
 *   open           — boolean
 *   onClose        — fn()
 *   customLabels   — fin_custom_labels[] from hook
 *   onAdd          — fn(name, colorHex) → Promise
 *   onDelete       — fn(labelKey) → Promise
 */
import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import Modal from '../ui/Modal'
import { toast } from '../ui/Toast'

// Preset colour palette — 8 swatches
const PALETTE = [
  '#e74c3c', // red
  '#e67e22', // orange
  '#f1c40f', // yellow
  '#2ecc71', // green
  '#3498db', // blue
  '#9b59b6', // purple
  '#1abc9c', // teal
  '#95a5a6', // grey
]

const MAX_CUSTOM = 20

export default function FinLabelManager({ open, onClose, customLabels = [], onAdd, onDelete }) {
  const [newName,    setNewName]    = useState('')
  const [newColor,   setNewColor]   = useState(PALETTE[0])
  const [adding,     setAdding]     = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) { toast.error('Enter a label name'); return }
    if (customLabels.length >= MAX_CUSTOM) {
      toast.error(`Maximum ${MAX_CUSTOM} custom labels allowed`)
      return
    }
    setAdding(true)
    try {
      await onAdd(name, newColor)
      setNewName('')
      setNewColor(PALETTE[0])
    } catch (err) {
      toast.error('Failed to add label: ' + (err.message ?? 'Unknown error'))
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (labelKey, labelName) => {
    if (!window.confirm(`Delete label "${labelName}"? Rows tagged with it will revert to Not Reviewed Yet.`)) return
    setDeletingId(labelKey)
    try {
      await onDelete(labelKey)
    } catch (err) {
      toast.error('Failed to delete label: ' + (err.message ?? 'Unknown error'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Labels" maxWidth="max-w-sm">
      {/* Existing custom labels */}
      {customLabels.length === 0 ? (
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          No custom labels yet. Add one below.
        </p>
      ) : (
        <ul className="mb-4 space-y-1">
          {customLabels.map(label => (
            <li
              key={label.label_key}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
              style={{ background: 'var(--bg-elevated)' }}
            >
              {/* Colour dot */}
              <span
                className="flex-shrink-0 w-3 h-3 rounded-full"
                style={{ background: label.color_hex }}
              />
              {/* Name */}
              <span
                className="flex-1 text-sm truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {label.label_name}
              </span>
              {/* Delete */}
              <button
                onClick={() => handleDelete(label.label_key, label.label_name)}
                disabled={deletingId === label.label_key}
                className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--error)', minHeight: '32px', minWidth: '32px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--error-light)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                aria-label={`Delete label ${label.label_name}`}
              >
                {deletingId === label.label_key
                  ? <span className="text-xs">…</span>
                  : <Trash2 size={14} />
                }
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Divider */}
      {customLabels.length > 0 && (
        <div className="mb-4" style={{ borderTop: '1px solid var(--border)' }} />
      )}

      {/* Add new label form */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
          Add new label
          {customLabels.length >= MAX_CUSTOM && (
            <span className="ml-2 text-xs" style={{ color: 'var(--error)' }}>
              (limit reached)
            </span>
          )}
        </p>

        {/* Name input */}
        <input
          type="text"
          placeholder="Label name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          maxLength={40}
          disabled={customLabels.length >= MAX_CUSTOM}
          className="w-full text-sm px-3 py-2 rounded-lg outline-none mb-3"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            minHeight: '40px',
          }}
        />

        {/* Colour swatches */}
        <div className="flex gap-2 flex-wrap mb-3">
          {PALETTE.map(hex => (
            <button
              key={hex}
              onClick={() => setNewColor(hex)}
              className="w-7 h-7 rounded-full transition-transform"
              style={{
                background: hex,
                outline: newColor === hex ? `2px solid var(--brand)` : 'none',
                outlineOffset: '2px',
                transform: newColor === hex ? 'scale(1.2)' : 'scale(1)',
              }}
              aria-label={`Colour ${hex}`}
            />
          ))}
        </div>

        {/* Preview + Add button */}
        <div className="flex items-center gap-2">
          {/* Preview pill */}
          <span
            className="flex-1 text-xs px-3 py-1.5 rounded-full font-medium truncate"
            style={{
              background: newColor + '22',
              color: newColor,
              border: `1px solid ${newColor}44`,
            }}
          >
            {newName || 'Preview'}
          </span>

          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim() || customLabels.length >= MAX_CUSTOM}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-opacity"
            style={{
              background: 'var(--brand)',
              color: 'var(--bg-surface)',
              opacity: (adding || !newName.trim() || customLabels.length >= MAX_CUSTOM) ? 0.5 : 1,
              minHeight: '40px',
            }}
          >
            <Plus size={14} />
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
