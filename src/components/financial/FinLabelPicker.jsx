/**
 * FinLabelPicker — Popover/bottom-sheet for picking a label on a ledger row.
 *
 * Props:
 *   currentLabel  — label_key string | null
 *   systemLabels  — array of system label objects (always present)
 *   customLabels  — array of fin_custom_labels rows
 *   onSelect      — fn(labelKey | null) — called with null to clear label
 *   onClose       — fn() — close the picker
 *   onManage      — fn() — open label manager
 *   anchorRef     — ref to the trigger element (used for desktop positioning)
 *
 * Desktop: small popover anchored to trigger.
 * Mobile: bottom sheet.
 */
import { useEffect, useRef } from 'react'
import { Tag, Settings } from 'lucide-react'

export const SYSTEM_LABELS = [
  { key: 'checked',          name: 'Checked ✓',        colorHex: '#2ecc71' },
  { key: 'make_receipt',     name: 'Make Receipt',      colorHex: '#e67e22' },
  { key: 'send_for_checking',name: 'Send for Checking', colorHex: '#3498db' },
  { key: 'not_reviewed',     name: 'Not Reviewed Yet',  colorHex: '#95a5a6' },
]

export default function FinLabelPicker({
  currentLabel,
  customLabels = [],
  onSelect,
  onClose,
  onManage,
}) {
  const pickerRef = useRef(null)

  // Close on outside click or Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  const handleSelect = (key) => {
    // Toggle: selecting active label removes it (back to not_reviewed / null)
    if (currentLabel === key) {
      onSelect(null)
    } else {
      onSelect(key)
    }
    onClose()
  }

  const allLabels = [...SYSTEM_LABELS, ...customLabels.map(c => ({
    key: c.label_key,
    name: c.label_name,
    colorHex: c.color_hex,
  }))]

  return (
    <>
      {/* Mobile: full-screen backdrop */}
      <div
        className="fixed inset-0 z-[70] md:hidden"
        style={{ background: 'var(--bg-overlay)' }}
        onClick={onClose}
      />

      {/* Picker container */}
      <div
        ref={pickerRef}
        className="z-[71] animate-fade-in fixed bottom-0 inset-x-0 rounded-t-2xl md:absolute md:bottom-auto md:inset-x-auto md:right-0 md:top-full md:mt-1 md:w-56 md:rounded-xl"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          isolation: 'isolate',
        }}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
        </div>

        <div className="p-2">
          {/* Header */}
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <Tag size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Set label
            </span>
          </div>

          {/* System labels */}
          {SYSTEM_LABELS.map(label => (
            <LabelOption
              key={label.key}
              label={label}
              isActive={currentLabel === label.key || (!currentLabel && label.key === 'not_reviewed')}
              onSelect={handleSelect}
            />
          ))}

          {/* Custom labels — shown only if any exist */}
          {customLabels.length > 0 && (
            <>
              <div
                className="my-1.5 mx-2"
                style={{ borderTop: '1px solid var(--border)' }}
              />
              {customLabels.map(c => (
                <LabelOption
                  key={c.label_key}
                  label={{ key: c.label_key, name: c.label_name, colorHex: c.color_hex }}
                  isActive={currentLabel === c.label_key}
                  onSelect={handleSelect}
                />
              ))}
            </>
          )}

          {/* Manage labels link */}
          <div
            className="mt-1.5 mx-2"
            style={{ borderTop: '1px solid var(--border)' }}
          />
          <button
            onClick={() => { onClose(); onManage() }}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors text-left"
            style={{ color: 'var(--brand)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--brand-light)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Settings size={12} />
            Manage labels…
          </button>
        </div>

        {/* Mobile safe area */}
        <div className="h-4 md:hidden" />
      </div>
    </>
  )
}

function LabelOption({ label, isActive, onSelect }) {
  const isNotReviewed = label.key === 'not_reviewed'
  return (
    <button
      onClick={() => onSelect(label.key)}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors text-left"
      style={{
        background: isActive ? 'var(--bg-elevated)' : 'transparent',
        minHeight: '36px',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-elevated)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Colour dot */}
      <span
        className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
        style={{
          background: label.colorHex,
          opacity: isNotReviewed ? 0.5 : 1,
        }}
      />
      <span style={{ color: 'var(--text-primary)', flex: 1 }}>
        {label.name}
      </span>
      {isActive && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>✓</span>
      )}
    </button>
  )
}