/**
 * CategoryTabs — vertical sidebar on desktop, horizontal scrollable strip on mobile.
 * Props:
 *   categories  — array of { id, name, icon, position }
 *   activeId    — number
 *   onSelect    — fn(id)
 *   loading     — bool
 */
export default function CategoryTabs({ categories = [], activeId, onSelect, loading = false }) {
  if (loading) {
    return (
      <>
        {/* Desktop skeleton */}
        <aside
          className="hidden md:flex flex-col w-48 lg:w-56 shrink-0 overflow-y-auto"
          style={{ background: 'var(--bg-elevated)', borderRight: '1px solid var(--border)' }}
        >
          {[...Array(7)].map((_, i) => (
            <div key={i} className="mx-3 my-1.5 h-9 rounded-xl animate-pulse" style={{ background: 'var(--border)' }} />
          ))}
        </aside>
        {/* Mobile skeleton */}
        <div
          className="md:hidden flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-full animate-pulse flex-shrink-0" style={{ background: 'var(--border)' }} />
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      {/* ── Desktop: vertical sidebar ─────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-48 lg:w-56 shrink-0 overflow-y-auto"
        style={{ background: 'var(--bg-elevated)', borderRight: '1px solid var(--border)' }}
      >
        <div className="px-3 pt-4 pb-2">
          <p className="label px-1">Categories</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-2 pb-4">
          {categories.map((cat) => {
            const isActive = cat.id === activeId
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150"
                style={{
                  color: isActive ? 'var(--brand)' : 'var(--text-primary)',
                  background: isActive ? 'var(--brand-light)' : 'transparent',
                  fontWeight: isActive ? '600' : '500',
                }}
              >
                {cat.icon && (
                  <span className="text-base leading-none flex-shrink-0">{cat.icon}</span>
                )}
                <span className="truncate">{cat.name}</span>
                {isActive && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--brand)' }}
                  />
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── Mobile: horizontal scrollable strip ───────────── */}
      <div
        className="md:hidden flex gap-2 px-4 py-2.5 overflow-x-auto"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {categories.map((cat) => {
          const isActive = cat.id === activeId
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all duration-150"
              style={{
                color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)',
                background: isActive ? 'var(--brand)' : 'var(--bg-surface)',
                border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                fontWeight: isActive ? '600' : '500',
              }}
            >
              {cat.icon && <span className="leading-none">{cat.icon}</span>}
              {cat.name}
            </button>
          )
        })}
      </div>
    </>
  )
}
