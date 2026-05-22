import { useRef, useEffect } from 'react'

/**
 * TabBar — horizontal scrollable tab strip per category.
 * Props:
 *   tabs      — array of { id, name, position }
 *   activeId  — number | null
 *   onSelect  — fn(id)
 *   loading   — bool
 */
export default function TabBar({ tabs = [], activeId, onSelect, loading = false }) {
  const scrollRef = useRef(null)
  const activeRef = useRef(null)

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current
      const el = activeRef.current
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2
      container.scrollTo({ left, behavior: 'smooth' })
    }
  }, [activeId])

  if (loading) {
    return (
      <div
        className="flex gap-2 px-4 py-3 overflow-x-auto"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          scrollbarWidth: 'none',
        }}
      >
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-lg animate-pulse flex-shrink-0" style={{ background: 'var(--border)' }} />
        ))}
      </div>
    )
  }

  if (tabs.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className="flex gap-1.5 px-4 py-3 overflow-x-auto"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            ref={isActive ? activeRef : null}
            onClick={() => onSelect(tab.id)}
            className="px-3.5 py-1.5 rounded-lg text-sm whitespace-nowrap flex-shrink-0 transition-all duration-150"
            style={{
              fontWeight: isActive ? '600' : '500',
              color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
              background: isActive ? 'var(--brand-light)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--brand-border)' : 'transparent'}`,
            }}
          >
            {tab.name}
          </button>
        )
      })}
    </div>
  )
}
