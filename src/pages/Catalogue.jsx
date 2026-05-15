import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../hooks/useStaffAuth'
import { useInventory } from '../hooks/useInventory'
import { buildSearchIndex } from '../utils/search'
import Navbar from '../components/layout/Navbar'
import CategoryTabs from '../components/catalogue/CategoryTabs'
import TabBar from '../components/catalogue/TabBar'
import ItemTable from '../components/catalogue/ItemTable'
import SearchBox from '../components/catalogue/SearchBox'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'

export default function Catalogue() {
  const navigate = useNavigate()
  const { staffUser, logout } = useStaffAuth()

  const {
    categories,
    tabs,
    items,
    loadingCats,
    loadingTabs,
    loadingItems,
    error,
    fetchCategories,
    fetchTabs,
    fetchItems,
    fetchAllTabs,
    fetchAllItems,
  } = useInventory()

  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [activeTabId, setActiveTabId]           = useState(null)
  const [highlightItemId, setHighlightItemId]   = useState(null)
  const [searchOpen, setSearchOpen]             = useState(false)
  const [fuse, setFuse]                         = useState(null)
  const [fuseBuilding, setFuseBuilding]         = useState(false)

  // ── Initial load: fetch categories ────────────────────────
  useEffect(() => {
    fetchCategories().then((cats) => {
      if (cats?.length > 0) {
        setActiveCategoryId(cats[0].id)
      }
    })
  }, [fetchCategories])

  // ── When category changes: fetch its tabs ─────────────────
  useEffect(() => {
    if (activeCategoryId == null) return
    setActiveTabId(null)
    fetchTabs(activeCategoryId).then((t) => {
      if (t?.length > 0) {
        setActiveTabId(t[0].id)
      }
      // else: BUTTONS category or empty — items area will show empty state
    })
  }, [activeCategoryId, fetchTabs])

  // ── When tab changes: fetch items ─────────────────────────
  useEffect(() => {
    if (activeTabId == null) return
    setHighlightItemId(null)
    fetchItems(activeTabId)
  }, [activeTabId, fetchItems])

  // ── Build search index once (after categories loaded) ─────
  useEffect(() => {
    if (categories.length === 0 || fuseBuilding || fuse) return
    setFuseBuilding(true)
    Promise.all([fetchAllTabs(), fetchAllItems()]).then(([allTabs, allItems]) => {
      const idx = buildSearchIndex(categories, allTabs, allItems)
      setFuse(idx)
      setFuseBuilding(false)
    })
  }, [categories, fuse, fuseBuilding, fetchAllTabs, fetchAllItems])

  // ── Category select ───────────────────────────────────────
  const handleCategorySelect = useCallback((id) => {
    if (id === activeCategoryId) return
    setActiveCategoryId(id)
  }, [activeCategoryId])

  // ── Tab select ────────────────────────────────────────────
  const handleTabSelect = useCallback((id) => {
    if (id === activeTabId) return
    setActiveTabId(id)
  }, [activeTabId])

  // ── Search navigation ─────────────────────────────────────
  const handleNavigate = useCallback(async ({ categoryId, tabId, itemId }) => {
    // Navigate to category
    if (categoryId && categoryId !== activeCategoryId) {
      setActiveCategoryId(categoryId)
      // Wait for tabs to load then navigate to specific tab
      const newTabs = await fetchTabs(categoryId)
      const targetTab = tabId
        ? newTabs.find(t => t.id === tabId)
        : newTabs[0]
      if (targetTab) {
        setActiveTabId(targetTab.id)
        if (itemId) {
          // Wait for items to load then highlight
          await fetchItems(targetTab.id)
          setHighlightItemId(itemId)
        }
      }
    } else if (tabId && tabId !== activeTabId) {
      setActiveTabId(tabId)
      if (itemId) {
        await fetchItems(tabId)
        setHighlightItemId(itemId)
      }
    } else if (itemId) {
      setHighlightItemId(itemId)
    }
  }, [activeCategoryId, activeTabId, fetchTabs, fetchItems])

  // ── Logout ────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    logout()
    navigate('/')
  }, [logout, navigate])

  // ── Error display ─────────────────────────────────────────
  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  // ── Active category object ────────────────────────────────
  const activeCategory = categories.find(c => c.id === activeCategoryId)
  const noTabs = !loadingTabs && tabs.length === 0 && activeCategoryId != null

  // ── Initial load spinner ──────────────────────────────────
  if (loadingCats && categories.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-base)' }}>
        <Navbar
          staffUser={staffUser}
          onLogout={handleLogout}
          showSearch={false}
        />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* ── Navbar ────────────────────────────────────────── */}
      <Navbar
        staffUser={staffUser}
        onLogout={handleLogout}
        onSearchOpen={() => setSearchOpen(true)}
        showSearch={true}
      />

      {/* ── Body: sidebar + content ───────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Category sidebar (desktop) / strip (mobile) ── */}
        <CategoryTabs
          categories={categories}
          activeId={activeCategoryId}
          onSelect={handleCategorySelect}
          loading={loadingCats}
        />

        {/* ── Main content area ─────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Category title — desktop only */}
          {activeCategory && (
            <div
              className="hidden md:flex items-center gap-2 px-5 py-3"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
            >
              {activeCategory.icon && (
                <span className="text-lg leading-none">{activeCategory.icon}</span>
              )}
              <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                {activeCategory.name}
              </h2>
            </div>
          )}

          {/* Tab bar */}
          {noTabs ? null : (
            <TabBar
              tabs={tabs}
              activeId={activeTabId}
              onSelect={handleTabSelect}
              loading={loadingTabs}
            />
          )}

          {/* Items */}
          <div className="flex-1 overflow-y-auto">
            {noTabs ? (
              // Empty-tab state (e.g. BUTTONS category)
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                  <span className="text-2xl">🗂️</span>
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  No tabs in this category
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Items will appear here once tabs are added.
                </p>
              </div>
            ) : (
              <ItemTable
                items={items}
                loading={loadingItems}
                highlightId={highlightItemId}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Search overlay ────────────────────────────────── */}
      <SearchBox
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        fuse={fuse}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
