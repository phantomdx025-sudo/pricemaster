import { useEffect, useRef } from 'react'
import Skeleton from '../ui/Skeleton'
import { useColSettings } from '../../hooks/useColSettings'

function Cell({ value, align }) {
  const isEmpty = value === null || value === undefined || value === ''
  return (
    <span
      className={`block ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: isEmpty ? 'var(--text-muted)' : 'inherit' }}
    >
      {isEmpty ? '—' : value}
    </span>
  )
}

/**
 * ItemTable — clean table for items within a tab.
 * Props:
 *   items         — array from useInventory
 *   loading       — bool
 *   highlightId   — item id to highlight (from search navigation)
 */
export default function ItemTable({ items = [], loading = false, highlightId = null }) {
  const highlightRef = useRef(null)
  const { cols } = useColSettings()

  // Only the visible columns, in order
  const visibleCols = cols.filter(c => c.visible)

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId])

  // ── Loading skeleton ───────────────────────────────────────
  if (loading) {
    return (
      <>
        {/* Desktop skeleton */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th
                  className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-right w-12"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap' }}
                >
                  Sl.No
                </th>
                <th
                  className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-left flex-1"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap' }}
                >
                  Item Name
                </th>
                {visibleCols.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-right w-24"
                    style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap' }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(10)].map((_, i) => <Skeleton.Row key={i} index={i} />)}
            </tbody>
          </table>
        </div>

        {/* Mobile skeleton */}
        <div className="md:hidden">
          {[...Array(6)].map((_, i) => <Skeleton.Card key={i} />)}
        </div>
      </>
    )
  }

  // ── Empty state ────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <span className="text-2xl">📦</span>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          No items in this tab yet
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Items will appear here once the admin adds them.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* ── Desktop table (md+) ───────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th
                className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-right w-12"
                style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap' }}
              >
                Sl.No
              </th>
              <th
                className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-left"
                style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap', minWidth: '160px' }}
              >
                Item Name
              </th>
              {visibleCols.map(col => (
                <th
                  key={col.key}
                  className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-right w-24"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isHighlighted = item.id === highlightId
              return (
                <tr
                  key={item.id}
                  ref={isHighlighted ? highlightRef : null}
                  className="transition-colors"
                  style={{
                    background: isHighlighted
                      ? 'var(--brand-light)'
                      : idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                    borderBottom: '1px solid var(--border)',
                    outline: isHighlighted ? '2px solid var(--brand-border)' : 'none',
                  }}
                >
                  <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {idx + 1}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                    <Cell value={item.item_name} align="left" />
                  </td>
                  {visibleCols.map((col) => (
                    <td key={col.key} className="px-4 py-2.5 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                      <Cell value={item[col.key]} align="right" />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards (< md) ───────────────────────────── */}
      <div className="md:hidden">
        {items.map((item, idx) => {
          const isHighlighted = item.id === highlightId
          return (
            <div
              key={item.id}
              ref={isHighlighted ? highlightRef : null}
              className="px-4 py-3"
              style={{
                borderBottom: '1px solid var(--border)',
                background: isHighlighted ? 'var(--brand-light)' : 'transparent',
                outline: isHighlighted ? '2px solid var(--brand-border)' : 'none',
              }}
            >
              {/* Row number + name */}
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {idx + 1}.
                </span>
                <span className="font-semibold text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {item.item_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </span>
              </div>

              {/* Price grid — only visible cols */}
              {visibleCols.length > 0 && (
                <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs ml-5">
                  {visibleCols.map(({ key, label }) => (
                    <div key={key}>
                      <span className="block" style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {label}
                      </span>
                      <span className="font-mono font-medium" style={{ color: item[key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {item[key] || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
