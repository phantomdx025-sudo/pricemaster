/**
 * ColSettingsPanel — Admin UI for column label + visibility settings.
 * Shown inside AdminCatalogue as a slide-in panel.
 *
 * Features:
 * - Rename each of the 5 data columns
 * - Toggle visibility (hidden columns disappear for staff too)
 * - Changes take effect immediately after Save
 */

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { useCatalogueWrite } from '../../hooks/useCatalogueWrite'
import { invalidateColSettings } from '../../hooks/useColSettings'
import { toast } from './Toast'
import Spinner from './Spinner'

const COL_DESCRIPTIONS = {
  rate:             'Main price shown (e.g. 105, 8/MTR)',
  rate_without_gst: 'Price excluding GST',
  unit_qty:         'Unit or quantity label (e.g. /roll, /mtr)',
  qty:              'Quantity rate field',
  qty_with_gst:     'Quantity price including GST',
}

export default function ColSettingsPanel({ open, onClose, currentCols }) {
  const [draft, setDraft] = useState([])
  const [saving, setSaving] = useState(false)
  const { call } = useCatalogueWrite()

  // Reset draft whenever panel opens with fresh cols
  useEffect(() => {
    if (open && currentCols?.length) {
      setDraft(currentCols.map(c => ({ ...c })))
    }
  }, [open, currentCols])

  if (!open) return null

  const updateLabel = (key, label) => {
    setDraft(prev => prev.map(c => c.key === key ? { ...c, label } : c))
  }

  const toggleVisible = (key) => {
    setDraft(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c))
  }

  const handleSave = async () => {
    // Validate — no empty labels
    const emptyLabel = draft.find(c => !c.label.trim())
    if (emptyLabel) {
      toast.error('Column labels cannot be empty')
      return
    }

    setSaving(true)
    try {
      await call('set-col-settings', { settings: draft })
      invalidateColSettings() // Clear cache so all consumers re-fetch
      toast.success('Column settings saved')
      onClose()
    } catch (err) {
      toast.error('Save failed: ' + (err.message ?? 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setDraft(currentCols.map(c => ({ ...c })))
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-sm shadow-2xl"
        style={{ background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              Column Settings
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Changes affect all staff and admin views
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:opacity-60"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Column list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {draft.map((col) => (
            <div
              key={col.key}
              className="rounded-xl p-4"
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${col.visible ? 'var(--border)' : 'var(--border)'}`,
                opacity: col.visible ? 1 : 0.55,
              }}
            >
              {/* Top row: visibility toggle + key name */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                >
                  {col.key}
                </span>
                <button
                  onClick={() => toggleVisible(col.key)}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                  style={{
                    background: col.visible ? 'var(--brand-light)' : 'var(--bg-elevated)',
                    color: col.visible ? 'var(--brand)' : 'var(--text-muted)',
                    border: `1px solid ${col.visible ? 'var(--brand-border)' : 'var(--border)'}`,
                  }}
                >
                  {col.visible
                    ? <><Eye size={12} /> Visible</>
                    : <><EyeOff size={12} /> Hidden</>
                  }
                </button>
              </div>

              {/* Label input */}
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                Header label shown in table
              </label>
              <input
                type="text"
                value={col.label}
                onChange={e => updateLabel(col.key, e.target.value)}
                maxLength={20}
                className="w-full px-3 py-2 rounded-lg text-sm font-medium outline-none"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                placeholder={col.key}
              />

              {/* Description */}
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {COL_DESCRIPTIONS[col.key]}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--brand)', color: 'var(--text-inverse)' }}
          >
            {saving
              ? <><Spinner size={14} color="var(--text-inverse)" /> Saving…</>
              : <><Check size={14} /> Save Changes</>
            }
          </button>
        </div>
      </div>
    </>
  )
}
