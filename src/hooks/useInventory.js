// useInventory.js — fetches categories, tabs, items from Supabase.
// Smart in-session cache: once a tab's items are loaded, they are never re-fetched
// until clearCache() is called.

import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Module-level cache survives re-renders but is cleared on full page reload.
const cache = {
  categories: null,    // array | null
  tabs: {},            // { [categoryId]: array }
  items: {},           // { [tabId]: array }
}

export function useInventory() {
  const [categories, setCategories] = useState([])
  const [tabs, setTabs]             = useState([])       // tabs for active category
  const [items, setItems]           = useState([])       // items for active tab
  const [loadingCats, setLoadingCats]     = useState(false)
  const [loadingTabs, setLoadingTabs]     = useState(false)
  const [loadingItems, setLoadingItems]   = useState(false)
  const [error, setError]           = useState(null)

  // ── Categories ──────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    if (cache.categories) {
      setCategories(cache.categories)
      return cache.categories
    }
    setLoadingCats(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('inv_categories')
      .select('*')
      .order('position')
    setLoadingCats(false)
    if (err) { setError(err.message); return [] }
    cache.categories = data ?? []
    setCategories(cache.categories)
    return cache.categories
  }, [])

  // ── Tabs ────────────────────────────────────────────────────
  const fetchTabs = useCallback(async (categoryId) => {
    if (cache.tabs[categoryId]) {
      setTabs(cache.tabs[categoryId])
      return cache.tabs[categoryId]
    }
    setLoadingTabs(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('inv_tabs')
      .select('*')
      .eq('category_id', categoryId)
      .order('position')
    setLoadingTabs(false)
    if (err) { setError(err.message); return [] }
    cache.tabs[categoryId] = data ?? []
    setTabs(cache.tabs[categoryId])
    return cache.tabs[categoryId]
  }, [])

  // ── Items ───────────────────────────────────────────────────
  const fetchItems = useCallback(async (tabId) => {
    if (cache.items[tabId]) {
      setItems(cache.items[tabId])
      return cache.items[tabId]
    }
    setLoadingItems(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('inv_items')
      .select('*')
      .eq('tab_id', tabId)
      .order('row_index')
    setLoadingItems(false)
    if (err) { setError(err.message); return [] }
    // Strip trailing \n from item_name
    const cleaned = (data ?? []).map(item => ({
      ...item,
      item_name: item.item_name?.replace(/\n+$/, '') ?? null,
    }))
    cache.items[tabId] = cleaned
    setItems(cleaned)
    return cleaned
  }, [])

  // ── All tabs flat (for search index) ───────────────────────
  const fetchAllTabs = useCallback(async () => {
    const { data } = await supabase
      .from('inv_tabs')
      .select('*')
      .order('position')
    return data ?? []
  }, [])

  // ── All items flat (for search index) ──────────────────────
  // Joins tab_id so we can map itemId → categoryId via tabs list
  const fetchAllItems = useCallback(async () => {
    const { data } = await supabase
      .from('inv_items')
      .select('id, tab_id, item_name, row_index')
      .order('row_index')
    return (data ?? []).map(item => ({
      ...item,
      item_name: item.item_name?.replace(/\n+$/, '') ?? null,
    }))
  }, [])

  const clearCache = useCallback(() => {
    cache.categories = null
    cache.tabs = {}
    cache.items = {}
  }, [])

  // Expose raw cache for search index builder (avoids extra round trips)
  const getCachedItems = useCallback(() => cache.items, [])

  return {
    categories,
    tabs,
    items,
    loadingCats,
    loadingTabs,
    loadingItems,
    // legacy single loading flag — true if any fetch is in flight
    loading: loadingCats || loadingTabs || loadingItems,
    error,
    fetchCategories,
    fetchTabs,
    fetchItems,
    fetchAllTabs,
    fetchAllItems,
    clearCache,
    getCachedItems,
  }
}
