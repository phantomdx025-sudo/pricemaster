// useCatalogueWrite — thin wrapper that calls the catalogue-write edge function.
// All writes are authenticated via the current admin session JWT.
// Returns { call, loading, error }

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/catalogue-write`

export function useCatalogueWrite() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const call = useCallback(async (action, payload) => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, payload }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      return json
    } catch (err) {
      const msg = err.message ?? 'Unknown error'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { call, loading, error }
}
