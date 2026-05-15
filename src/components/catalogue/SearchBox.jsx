import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Tag, Grid3X3, Package } from 'lucide-react'
import { search } from '../../utils/search'

const TYPE_ICON = {
  category: Grid3X3,
  tab:      Tag,
  item:     Package,
}

const TYPE_LABEL = {
  category: 'Category',
  tab:      'Tab',
  item:     'Item',
}

/**
 * SearchBox — full-screen overlay with fuzzy search.
 * Props:
 *   open       — bool
 *   onClose    — fn()
 *   fuse       — Fuse instance from buildSearchIndex
 *   onNavigate — fn({ categoryId, tabId, itemId })
 */
export default function SearchBox({ open, onClose, fuse, onNavigate }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const inputRef = useRef(null)

  // Auto-focus when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  // Run search as user types
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    setResults(search(fuse, query, 30))
  }, [query, fuse])

  // Keyboard close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSelect = useCallback((result) => {
    onNavigate(result)
    onClose()
  }, [onNavigate, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--bg-overlay)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl mx-auto mt-16 mb-4 mx-4 rounded-2xl overflow-hidden flex flex-col animate-slide-up"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
          maxHeight: 'calc(100dvh - 8rem)',
          margin: '4rem auto 0',
          width: 'calc(100% - 2rem)',
        }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search items, categories, tabs…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)', fontFamily: '"DM Sans", sans-serif' }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="transition-opacity hover:opacity-70 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-1 text-xs px-2 py-1 rounded-lg transition-colors flex-shrink-0"
            style={{
              color: 'var(--text-muted)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            Esc
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {!query.trim() && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Search size={28} style={{ color: 'var(--border-strong)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Type to search across all items
              </p>
            </div>
          )}

          {query.trim() && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No results for <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>"{query}"</span>
              </p>
            </div>
          )}

          {results.length > 0 && (
            <ul>
              {results.map((result, idx) => {
                const Icon = TYPE_ICON[result.type] ?? Package
                return (
                  <li key={`${result.type}-${result.itemId ?? result.tabId ?? result.categoryId}-${idx}`}>
                    <button
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)]"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--brand-light)' }}
                      >
                        <Icon size={14} style={{ color: 'var(--brand)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {result.label}
                        </p>
                      </div>
                      <span
                        className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full"
                        style={{
                          color: 'var(--text-muted)',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {TYPE_LABEL[result.type]}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
