/**
 * ItemForm — slide-in drawer for adding or editing an inv_item.
 *
 * Props:
 *   open        — bool
 *   onClose     — fn()
 *   onSave      — fn(formData) → Promise (caller handles the actual write)
 *   item        — object | null  (null = "add new" mode)
 *   loading     — bool (save in progress)
 */

import { useEffect, useState } from 'react'
import { X, Save } from 'lucide-react'
import Spinner from '../ui/Spinner'

const EMPTY = {
  item_name: '',
  rate: '',
  rate_without_gst: '',
  unit_qty: '',
  qty: '',
  qty_with_gst: '',
}

const FIELDS = [
  { key: 'item_name',       label: 'Item Name',   placeholder: 'e.g. Cotton Plain Fabric', span: 'col-span-2' },
  { key: 'rate',            label: 'Rate',        placeholder: 'e.g. 8/MTR' },
  { key: 'rate_without_gst',label: 'W/O GST',     placeholder: 'e.g. 7.20/MTR' },
  { key: 'unit_qty',        label: 'Unit / Qty',  placeholder: 'e.g. 1 MTR' },
  { key: 'qty',             label: 'Qty Rate',    placeholder: 'e.g. 600/roll' },
  { key: 'qty_with_gst',    label: 'QTY w/GST',   placeholder: 'e.g. 660/roll' },
]

export default function ItemForm({ open, onClose, onSave, item = null, loading = false }) {
  const [form, setForm] = useState(EMPTY)
  const isEdit = item !== null

  // Populate form when item changes
  useEffect(() => {
    if (open) {
      setForm(
        item
          ? {
              item_name: item.item_name ?? '',
              rate: item.rate ?? '',
              rate_without_gst: item.rate_without_gst ?? '',
              unit_qty: item.unit_qty ?? '',
              qty: item.qty ?? '',
              qty_with_gst: item.qty_with_gst ?? '',
            }
          : EMPTY
      )
    }
  }, [open, item])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleChange = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.item_name.trim()) return
    await onSave(form)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'var(--bg-overlay)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={!loading ? onClose : undefined}
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 'min(420px, 100vw)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="font-display font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
              {isEdit ? 'Edit Item' : 'Add Item'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {isEdit ? 'Update the item details below.' : 'Fill in the details for the new item.'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map(({ key, label, placeholder, span }) => (
              <div key={key} className={span ?? 'col-span-1'}>
                <label className="label">
                  {label}
                  {key === 'item_name' && <span style={{ color: 'var(--error)' }}> *</span>}
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={loading}
                  required={key === 'item_name'}
                  autoFocus={key === 'item_name' && open}
                />
              </div>
            ))}
          </div>

          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            All rate fields are stored as text — values like "8/MTR" and "600/roll" are fine.
          </p>
        </form>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !form.item_name.trim()}
            onClick={handleSubmit}
          >
            {loading ? (
              <><Spinner size={16} color="var(--text-inverse)" /> Saving…</>
            ) : (
              <><Save size={16} /> {isEdit ? 'Update Item' : 'Add Item'}</>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
