import Fuse from 'fuse.js'

/**
 * Build a flat Fuse.js search index from categories, tabs, and items.
 * tabCategoryMap: { [tabId]: categoryId } — built from the tabs array so we
 * can navigate to the right category when an item result is clicked.
 *
 * Each result doc shape:
 * { type: 'category'|'tab'|'item', label, categoryId, tabId, itemId }
 */
export function buildSearchIndex(categories = [], allTabs = [], allItems = []) {
  // Build a quick lookup: tabId → categoryId
  const tabCategoryMap = {}
  for (const tab of allTabs) {
    tabCategoryMap[tab.id] = tab.category_id
  }

  const docs = []

  for (const cat of categories) {
    docs.push({
      type: 'category',
      label: cat.name,
      categoryId: cat.id,
      tabId: null,
      itemId: null,
    })
  }

  for (const tab of allTabs) {
    docs.push({
      type: 'tab',
      label: tab.name,
      categoryId: tab.category_id,
      tabId: tab.id,
      itemId: null,
    })
  }

  for (const item of allItems) {
    if (!item.item_name) continue
    docs.push({
      type: 'item',
      label: item.item_name,
      categoryId: tabCategoryMap[item.tab_id] ?? null,
      tabId: item.tab_id,
      itemId: item.id,
    })
  }

  const fuse = new Fuse(docs, {
    keys: ['label'],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 2,
  })

  return fuse
}

/**
 * Run a fuzzy search. Returns array of result objects (up to `limit`).
 */
export function search(fuse, query, limit = 30) {
  if (!fuse || !query?.trim()) return []
  return fuse.search(query.trim(), { limit }).map(r => r.item)
}
