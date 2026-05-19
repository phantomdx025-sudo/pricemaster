/**
 * AdminCatalogue — mirrors the staff catalogue but every item has Edit/Delete buttons.
 * Also adds TabManager (add/delete tabs) and a "Manage Categories" button.
 *
 * Exported as both a standalone page component AND as a content-only component
 * used inside AdminPanel. It checks for layout context automatically.
 */

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, FolderCog } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useInventory } from '../hooks/useInventory'
import { useCatalogueWrite } from '../hooks/useCatalogueWrite'
import CategoryTabs from '../components/catalogue/CategoryTabs'
import ItemForm from '../components/admin/ItemForm'
import TabManager from '../components/admin/TabManager'
import CategoryManager from '../components/admin/CategoryManager'
import Modal from '../components/ui/Modal'
import PasswordReconfirm from '../components/admin/PasswordReconfirm'
import Spinner from '../components/ui/Spinner'
import { toast } from '../components/ui/Toast'
import SearchBox from '../components/catalogue/SearchBox'
import { buildSearchIndex } from '../utils/search'

// ── Admin item table ────────────────────────────────────────
function AdminItemRow({ item, index, onEdit, onDelete }) {
  return (
    <tr
      className="group transition-colors"
      style={{
        background: index % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <td className="px-3 py-2.5 text-right font-mono text-xs w-10" style={{ color: 'var(--text-muted)' }}>
        {index + 1}
      </td>
      <td className="px-3 py-2.5 font-medium text-sm" style={{ color: 'var(--text-primary)', minWidth: '160px' }}>
        {item.item_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </td>
      {['rate', 'rate_without_gst', 'unit_qty', 'qty', 'qty_with_gst'].map((col) => (
        <td key={col} className="px-3 py-2.5 text-right font-mono text-sm" style={{ color: item[col] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {item[col] || '—'}
        </td>
      ))}
      {/* Actions */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: 'var(--brand)', background: 'var(--brand-light)' }}
            onClick={() => onEdit(item)}
            title="Edit item"
          >
            <Pencil size={13} />
          </button>
          <button
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: 'var(--error)', background: 'var(--error-light)' }}
            onClick={() => onDelete(item)}
            title="Delete item"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function AdminItemCard({ item, index, onEdit, onDelete }) {
  return (
    <div
      className="px-4 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
          {item.item_name || '—'}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--brand)', background: 'var(--brand-light)' }}
            onClick={() => onEdit(item)}
          >
            <Pencil size={13} />
          </button>
          <button
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--error)', background: 'var(--error-light)' }}
            onClick={() => onDelete(item)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
        {[
          { label: 'Rate', value: item.rate },
          { label: 'W/O GST', value: item.rate_without_gst },
          { label: 'Unit/Qty', value: item.unit_qty },
          { label: 'Qty Rate', value: item.qty },
          { label: 'QTY w/GST', value: item.qty_with_gst },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="uppercase tracking-wide font-semibold mb-0.5" style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{label}</p>
            <p className="font-mono" style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>{value || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main AdminCatalogue component ───────────────────────────
export default function AdminCatalogue({ searchOpen = false, onSearchClose = () => {} }) {
  const { isReconfirmed, reconfirmIdentity } = useAuth()
  const { call: writeCall, loading: writing } = useCatalogueWrite()

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
    clearCache,
  } = useAdminInventory()

  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [activeTabId, setActiveTabId]           = useState(null)
  const [localCategories, setLocalCategories]   = useState([])
  const [localTabs, setLocalTabs]               = useState([])
  const [localItems, setLocalItems]             = useState([])

  // ItemForm state
  const [formOpen, setFormOpen]     = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  // Delete item state
  const [deleteItemTarget, setDeleteItemTarget] = useState(null)
  const [deleteItemOpen, setDeleteItemOpen]     = useState(false)
  const [deleteItemLoading, setDeleteItemLoading] = useState(false)

  // Category manager
  const [catManagerOpen, setCatManagerOpen] = useState(false)

  // Search state
  const [fuse, setFuse]           = useState(null)
  const [fuseBuilding, setFuseBuilding] = useState(false)
  const [highlightItemId, setHighlightItemId] = useState(null)

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    fetchCategories().then((cats) => {
      setLocalCategories(cats)
      if (cats?.length > 0) setActiveCategoryId(cats[0].id)
    })
  }, [fetchCategories])

  useEffect(() => {
    if (activeCategoryId == null) return
    setActiveTabId(null)
    setLocalItems([])
    fetchTabs(activeCategoryId).then((t) => {
      setLocalTabs(t)
      if (t?.length > 0) setActiveTabId(t[0].id)
    })
  }, [activeCategoryId, fetchTabs])

  useEffect(() => {
    if (activeTabId == null) return
    fetchItems(activeTabId).then((it) => setLocalItems(it))
  }, [activeTabId, fetchItems])

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  // ── Build search index once categories loaded ─────────────
  useEffect(() => {
    if (localCategories.length === 0 || fuseBuilding || fuse) return
    setFuseBuilding(true)
    Promise.all([fetchAllTabs(), fetchAllItems()]).then(([allTabs, allItems]) => {
      setFuse(buildSearchIndex(localCategories, allTabs, allItems))
      setFuseBuilding(false)
    })
  }, [localCategories, fuse, fuseBuilding, fetchAllTabs, fetchAllItems])

  // ── Search navigate ───────────────────────────────────────
  const handleSearchNavigate = async ({ categoryId, tabId, itemId }) => {
    if (categoryId && categoryId !== activeCategoryId) {
      setActiveCategoryId(categoryId)
      const newTabs = await fetchTabs(categoryId)
      setLocalTabs(newTabs)
      const targetTab = tabId ? newTabs.find(t => t.id === tabId) : newTabs[0]
      if (targetTab) {
        setActiveTabId(targetTab.id)
        const its = await fetchItems(targetTab.id)
        setLocalItems(its)
        if (itemId) setHighlightItemId(itemId)
      }
    } else if (tabId && tabId !== activeTabId) {
      setActiveTabId(tabId)
      const its = await fetchItems(tabId)
      setLocalItems(its)
      if (itemId) setHighlightItemId(itemId)
    } else if (itemId) {
      setHighlightItemId(itemId)
    }
  }

  // ── Category mutations ────────────────────────────────────
  const handleCategoryAdded = (newCat) => {
    const updated = [...localCategories, newCat]
    setLocalCategories(updated)
    clearCache()
  }

  const handleCategoryDeleted = (catId) => {
    const updated = localCategories.filter(c => c.id !== catId)
    setLocalCategories(updated)
    if (activeCategoryId === catId) {
      setActiveCategoryId(updated[0]?.id ?? null)
    }
    clearCache()
  }

  // ── Tab mutations ─────────────────────────────────────────
  const handleTabAdded = (newTab) => {
    const updated = [...localTabs, newTab]
    setLocalTabs(updated)
    setActiveTabId(newTab.id)
    setLocalItems([])
    clearCache()
  }

  const handleTabDeleted = (tabId) => {
    const updated = localTabs.filter(t => t.id !== tabId)
    setLocalTabs(updated)
    if (activeTabId === tabId) {
      const next = updated[0]
      setActiveTabId(next?.id ?? null)
      if (next) {
        fetchItems(next.id).then(it => setLocalItems(it))
      } else {
        setLocalItems([])
      }
    }
    clearCache()
  }

  // ── Item: open form ───────────────────────────────────────
  const handleAddItem = () => {
    setEditingItem(null)
    setFormOpen(true)
  }

  const handleEditItem = (item) => {
    setEditingItem(item)
    setFormOpen(true)
  }

  // ── Item: save (add or update) ────────────────────────────
  const handleFormSave = async (formData) => {
    setFormLoading(true)
    try {
      if (editingItem) {
        // Update
        const res = await writeCall('update-item', { id: editingItem.id, ...formData })
        const updated = localItems.map(it => it.id === editingItem.id ? { ...it, ...res.data } : it)
        setLocalItems(updated)
        clearCache()
        toast.success('Item updated')
      } else {
        // Add
        const res = await writeCall('add-item', { tab_id: activeTabId, ...formData })
        setLocalItems(prev => [...prev, res.data])
        clearCache()
        toast.success('Item added')
      }
      setFormOpen(false)
      setEditingItem(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  // ── Item: delete ──────────────────────────────────────────
  const handleDeleteItemClick = (item) => {
    setDeleteItemTarget(item)
    setDeleteItemOpen(true)
  }

  const handleDeleteItemConfirm = async () => {
    if (!deleteItemTarget) return
    setDeleteItemLoading(true)
    try {
      await writeCall('delete-item', { id: deleteItemTarget.id })
      setLocalItems(prev => prev.filter(it => it.id !== deleteItemTarget.id))
      clearCache()
      toast.success('Item deleted')
      setDeleteItemOpen(false)
      setDeleteItemTarget(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleteItemLoading(false)
    }
  }

  const activeCategory = localCategories.find(c => c.id === activeCategoryId)
  const noTabs = !loadingTabs && localTabs.length === 0 && activeCategoryId != null

  // ── Initial load ──────────────────────────────────────────
  if (loadingCats && localCategories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 md:flex-row">

      {/* ── Category sidebar ────────────────────────────── */}
      <div className="relative">
        <CategoryTabs
          categories={localCategories}
          activeId={activeCategoryId}
          onSelect={(id) => { if (id !== activeCategoryId) setActiveCategoryId(id) }}
          loading={loadingCats}
        />
        {/* Manage categories button (bottom of desktop sidebar) */}
        <button
          className="hidden md:flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium border-t transition-colors hover:opacity-80"
          style={{
            color: 'var(--text-muted)',
            borderColor: 'var(--border)',
            background: 'var(--bg-elevated)',
          }}
          onClick={() => setCatManagerOpen(true)}
        >
          <FolderCog size={14} />
          Manage Categories
        </button>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Content header */}
        <div
          className="flex items-center justify-between gap-2 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
        >
          <div className="flex items-center gap-2">
            {activeCategory?.icon && <span className="text-base leading-none">{activeCategory.icon}</span>}
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              {activeCategory?.name ?? 'Catalogue'}
            </h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
            >
              {localItems.length} item{localItems.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile: manage categories */}
            <button
              className="md:hidden btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5"
              onClick={() => setCatManagerOpen(true)}
            >
              <FolderCog size={14} /> Categories
            </button>
            {/* Add item */}
            {!noTabs && activeTabId && (
              <button className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5" onClick={handleAddItem}>
                <Plus size={15} /> Add Item
              </button>
            )}
          </div>
        </div>

        {/* Tab manager (replaces plain tab bar) */}
        {!noTabs && (
          <TabManager
            categoryId={activeCategoryId}
            tabs={localTabs}
            activeTabId={activeTabId}
            onTabAdded={handleTabAdded}
            onTabDeleted={handleTabDeleted}
            onTabSelect={(id) => { if (id !== activeTabId) setActiveTabId(id) }}
            isReconfirmed={isReconfirmed}
            reconfirmIdentity={reconfirmIdentity}
            writeCall={writeCall}
            writing={writing}
          />
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {noTabs ? (
            // Empty-tab state
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <span className="text-2xl">🗂️</span>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No tabs in this category</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add a tab above to get started.</p>
              {activeCategoryId && (
                <TabManager
                  categoryId={activeCategoryId}
                  tabs={[]}
                  activeTabId={null}
                  onTabAdded={handleTabAdded}
                  onTabDeleted={handleTabDeleted}
                  onTabSelect={() => {}}
                  isReconfirmed={isReconfirmed}
                  reconfirmIdentity={reconfirmIdentity}
                  writeCall={writeCall}
                  writing={writing}
                />
              )}
            </div>
          ) : loadingItems ? (
            <div className="flex items-center justify-center py-20"><Spinner size={28} /></div>
          ) : localItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <span className="text-2xl">📦</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No items in this tab yet.</p>
              <button className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5" onClick={handleAddItem}>
                <Plus size={15} /> Add First Item
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['#', 'Item Name', 'Rate', 'W/O GST', 'Unit/Qty', 'Qty Rate', 'QTY w/GST', ''].map((h, i) => (
                        <th
                          key={i}
                          className={`px-3 py-3 font-semibold text-xs uppercase tracking-wide ${i === 0 || i > 1 ? 'text-right' : 'text-left'}`}
                          style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)', whiteSpace: 'nowrap' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {localItems.map((item, idx) => (
                      <AdminItemRow
                        key={item.id}
                        item={item}
                        index={idx}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItemClick}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                {localItems.map((item, idx) => (
                  <AdminItemCard
                    key={item.id}
                    item={item}
                    index={idx}
                    onEdit={handleEditItem}
                    onDelete={handleDeleteItemClick}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Item form drawer ─────────────────────────────── */}
      <ItemForm
        open={formOpen}
        onClose={() => { if (!formLoading) { setFormOpen(false); setEditingItem(null) } }}
        onSave={handleFormSave}
        item={editingItem}
        loading={formLoading}
      />

      {/* ── Delete item confirm ──────────────────────────── */}
      <Modal
        open={deleteItemOpen}
        onClose={!deleteItemLoading ? () => { setDeleteItemOpen(false); setDeleteItemTarget(null) } : undefined}
        title="Delete item?"
        maxWidth="max-w-sm"
      >
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {deleteItemTarget?.item_name || 'this item'}
          </strong>
          ? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            className="btn-ghost flex-1"
            onClick={() => { setDeleteItemOpen(false); setDeleteItemTarget(null) }}
            disabled={deleteItemLoading}
          >
            Cancel
          </button>
          <button
            className="btn-primary flex-1"
            style={{ background: 'var(--error)' }}
            onClick={handleDeleteItemConfirm}
            disabled={deleteItemLoading}
          >
            {deleteItemLoading ? <><Spinner size={15} color="var(--text-inverse)" /> Deleting…</> : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* ── Search overlay ───────────────────────────────── */}
      <SearchBox
        open={searchOpen}
        onClose={onSearchClose}
        fuse={fuse}
        onNavigate={handleSearchNavigate}
      />

      {/* ── Category manager ─────────────────────────────── */}
      <CategoryManager
        open={catManagerOpen}
        onClose={() => setCatManagerOpen(false)}
        categories={localCategories}
        activeCategoryId={activeCategoryId}
        onCategoryAdded={handleCategoryAdded}
        onCategoryDeleted={handleCategoryDeleted}
        isReconfirmed={isReconfirmed}
        reconfirmIdentity={reconfirmIdentity}
        writeCall={writeCall}
      />
    </div>
  )
}

// ── Custom hook: admin inventory (wraps useInventory) ─────────
// Simple passthrough; AdminCatalogue manages its own local state on top.
function useAdminInventory() {
  return useInventory()
}
