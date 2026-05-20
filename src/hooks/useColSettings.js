// useColSettings — fetches column label/visibility settings from Supabase.
// Settings are publicly readable (anon key) so both staff and admin see them.
// Admin can write them via catalogue-write edge function (set-col-settings).
//
// Module-level cache: settings are loaded once per page load and shared
// across all consumers. A manual invalidate() call clears the cache.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Default settings — used as fallback if table doesn't exist yet or on error.
export const DEFAULT_COL_SETTINGS = [
  { key: 'rate',             label: 'Rate',       visible: true, position: 0 },
  { key: 'rate_without_gst', label: 'W/O GST',    visible: true, position: 1 },
  { key: 'unit_qty',         label: 'Unit/Qty',   visible: true, position: 2 },
  { key: 'qty',              label: 'Qty Rate',   visible: true, position: 3 },
  { key: 'qty_with_gst',     label: 'QTY w/GST',  visible: true, position: 4 },
]

// Module-level cache — survives re-renders, cleared on page reload
let _cache = null
let _listeners = []

function notifyListeners(settings) {
  _listeners.forEach(fn => fn(settings))
}

export function invalidateColSettings() {
  _cache = null
  notifyListeners(null)
}

async function fetchSettings() {
  try {
    const { data, error } = await supabase
      .from('inv_col_settings')
      .select('key, label, visible, position')
      .order('position', { ascending: true })

    if (error || !data || data.length === 0) return DEFAULT_COL_SETTINGS
    return data
  } catch (_) {
    return DEFAULT_COL_SETTINGS
  }
}

/**
 * useColSettings()
 *
 * Returns { cols, loading, reload }
 *   cols    — array of { key, label, visible } in display order
 *   loading — bool
 *   reload  — function to force re-fetch (call after admin saves)
 */
export function useColSettings() {
  const [cols, setCols] = useState(_cache ?? DEFAULT_COL_SETTINGS)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    // Subscribe to cache updates (e.g. admin saves, this consumer is on a different route)
    const handler = (settings) => {
      if (settings) setCols(settings)
      else setLoading(true)
    }
    _listeners.push(handler)

    if (!_cache) {
      setLoading(true)
      fetchSettings().then(settings => {
        _cache = settings
        setCols(settings)
        setLoading(false)
        notifyListeners(settings)
      })
    } else {
      setCols(_cache)
      setLoading(false)
    }

    return () => {
      _listeners = _listeners.filter(fn => fn !== handler)
    }
  }, [])

  const reload = useCallback(async () => {
    _cache = null
    setLoading(true)
    const settings = await fetchSettings()
    _cache = settings
    setCols(settings)
    setLoading(false)
    notifyListeners(settings)
  }, [])

  return { cols, loading, reload }
}
